import { ValidationError, raw } from "objection";
import type {
  Pojo,
  QueryContext,
  RelationMappings,
  TransactionOrKnex,
} from "objection";

import config from "@/config/index.js";

import { Model } from "../util/model.js";
import {
  JobStatus,
  jobModelSchema,
  mergeSchemas,
  timestampsSchema,
} from "../util/schemas.js";
import { GithubPullRequest } from "./GithubPullRequest.js";
import { Project } from "./Project.js";
import { ScreenshotBucket } from "./ScreenshotBucket.js";
import { ScreenshotDiff } from "./ScreenshotDiff.js";
import { User } from "./User.js";

export type BuildType = "orphan" | "reference" | "check";
type BuildStatus =
  | "expired"
  | "pending"
  | "progress"
  | "complete"
  | "error"
  | "aborted";
type BuildConclusion = "stable" | "diffDetected" | null;
type BuildReviewStatus = "accepted" | "rejected" | null;
export type BuildAggregatedStatus = NonNullable<
  BuildReviewStatus | BuildConclusion | Exclude<BuildStatus, "complete">
>;

export class Build extends Model {
  static override tableName = "builds";

  static override jsonSchema = mergeSchemas(timestampsSchema, jobModelSchema, {
    required: ["compareScreenshotBucketId", "projectId"],
    properties: {
      name: { type: "string", maxLength: 255 },
      baseScreenshotBucketId: { type: ["string", "null"] },
      compareScreenshotBucketId: { type: "string" },
      projectId: { type: "string" },
      number: { type: "integer" },
      externalId: { type: ["string", "null"] },
      batchCount: { type: ["integer", "null"] },
      totalBatch: { type: ["integer", "null"] },
      type: {
        type: ["string", "null"],
        enum: ["reference", "check", "orphan"],
      },
      prNumber: { type: ["integer", "null"] },
      prHeadCommit: { type: ["string", "null"] },
      githubPullRequestId: { type: ["string", "null"] },
      referenceCommit: { type: ["string", "null"] },
      referenceBranch: { type: ["string", "null"] },
    },
  });

  name!: string;
  jobStatus!: JobStatus;
  baseScreenshotBucketId!: string | null;
  compareScreenshotBucketId!: string;
  projectId!: string;
  number!: number;
  externalId!: string | null;
  batchCount!: number | null;
  totalBatch!: number | null;
  type!: BuildType | null;
  prNumber!: number | null;
  prHeadCommit!: string | null;
  githubPullRequestId!: string | null;
  referenceCommit!: string | null;
  referenceBranch!: string | null;

  static override get relationMappings(): RelationMappings {
    return {
      baseScreenshotBucket: {
        relation: Model.BelongsToOneRelation,
        modelClass: ScreenshotBucket,
        join: {
          from: "builds.baseScreenshotBucketId",
          to: "screenshot_buckets.id",
        },
      },
      compareScreenshotBucket: {
        relation: Model.BelongsToOneRelation,
        modelClass: ScreenshotBucket,
        join: {
          from: "builds.compareScreenshotBucketId",
          to: "screenshot_buckets.id",
        },
      },
      project: {
        relation: Model.BelongsToOneRelation,
        modelClass: Project,
        join: {
          from: "builds.projectId",
          to: "projects.id",
        },
      },
      screenshotDiffs: {
        relation: Model.HasManyRelation,
        modelClass: ScreenshotDiff,
        join: {
          from: "builds.id",
          to: "screenshot_diffs.buildId",
        },
      },
      pullRequest: {
        relation: Model.BelongsToOneRelation,
        modelClass: GithubPullRequest,
        join: {
          from: "builds.githubPullRequestId",
          to: "github_pull_requests.id",
        },
      },
    };
  }

  baseScreenshotBucket?: ScreenshotBucket | null;
  compareScreenshotBucket?: ScreenshotBucket;
  project?: Project;
  screenshotDiffs?: ScreenshotDiff[];
  pullRequest?: GithubPullRequest | null;

  override $afterValidate(json: Pojo) {
    if (
      json["baseScreenshotBucketId"] &&
      json["baseScreenshotBucketId"] === json["compareScreenshotBucketId"]
    ) {
      throw new ValidationError({
        type: "ModelValidation",
        message:
          "The base screenshot bucket should be different to the compare one.",
      });
    }
  }

  override $beforeInsert(queryContext: QueryContext) {
    super.$beforeInsert(queryContext);
    if (this.number === undefined) {
      this.number = -1;
    }
  }

  override $toDatabaseJson(...args: any[]) {
    // @ts-ignore
    const json = super.$toDatabaseJson(...args);
    if (json["number"] === -1) {
      json["number"] = this.$knex().raw(
        '(select coalesce(max(number),0) + 1 as number from builds where "projectId" = ?)',
        this.projectId,
      );
    }
    return json;
  }

  override $afterInsert(queryContext: QueryContext) {
    super.$afterInsert(queryContext);
    return this.reload(queryContext);
  }

  /**
   * Get status of the build.
   * Aggregate statuses from screenshot diffs.
   */
  static async getStatuses(builds: Build[]) {
    const completeBuildIds = builds
      .filter(({ jobStatus }) => jobStatus === "complete")
      .map(({ id }) => id);

    const screenshotDiffs = completeBuildIds.length
      ? await ScreenshotDiff.query()
          .select("buildId", "jobStatus")
          .whereIn("buildId", completeBuildIds)
          .groupBy("buildId", "jobStatus")
      : [];

    return builds.map((build) => {
      switch (build.jobStatus) {
        case "pending":
        case "progress":
          return Date.now() - new Date(build.createdAt).getTime() >
            2 * 3600 * 1000
            ? "expired"
            : "pending";

        case "error":
        case "aborted":
          return build.jobStatus;

        case "complete": {
          const diffJobStatuses = screenshotDiffs
            .filter(({ buildId }) => build.id === buildId)
            .map(({ jobStatus }) => jobStatus);

          if (diffJobStatuses.includes("error")) {
            return "error";
          }

          if (
            diffJobStatuses.length === 0 ||
            (diffJobStatuses.length === 1 && diffJobStatuses[0] === "complete")
          ) {
            return "complete";
          }

          return "progress";
        }
        default:
          throw new Error(`Unknown job status: ${build.jobStatus}`);
      }
    });
  }

  /**
   * Get stats of the build.
   */
  static async getStats(buildId: string) {
    const data = (await ScreenshotDiff.query()
      .where("buildId", buildId)
      .leftJoinRelated("compareScreenshot")
      .select(raw(`(${ScreenshotDiff.selectDiffStatus}) as status`))
      .count("*")
      .groupBy("status")) as unknown as { status: string; count: string }[];

    return data.reduce(
      (res, { status, count }) => ({
        ...res,
        [status]: Number(count),
        total: Number(count) + res.total,
      }),
      { failure: 0, added: 0, unchanged: 0, changed: 0, removed: 0, total: 0 },
    );
  }

  /**
   * Get status of the current build.
   */
  async $getStatus() {
    const statuses = await Build.getStatuses([this]);
    return statuses[0];
  }

  /**
   * Get the conclusion of builds.
   */
  static async getConclusions(
    buildIds: string[],
    statuses: BuildStatus[],
  ): Promise<BuildConclusion[]> {
    const completeBuildIds = buildIds.filter(
      (_, index) => statuses[index] === "complete",
    );

    const buildsDiffCount = (completeBuildIds.length
      ? await ScreenshotDiff.query()
          .select("buildId")
          .leftJoinRelated("compareScreenshot")
          .count("*")
          .whereIn(raw(ScreenshotDiff.selectDiffStatus), [
            "added",
            "changed",
            "removed",
          ])
          .whereIn("buildId", completeBuildIds)
          .groupBy("buildId")
      : []) as unknown as { buildId: string; count: number }[];

    return buildIds.map((buildId, index) => {
      if (statuses[index] !== "complete") {
        return null;
      }
      const buildDiffCount = buildsDiffCount.find(
        (diff) => diff.buildId === buildId,
      );
      if (buildDiffCount && buildDiffCount.count > 0) {
        return "diffDetected";
      }
      return "stable";
    });
  }

  /**
   * Get the review status of builds.
   */
  static async getReviewStatuses(
    buildIds: string[],
    conclusions: BuildConclusion[],
  ): Promise<BuildReviewStatus[]> {
    const diffDetectedBuildIds = buildIds.filter(
      (_buildId, index) => conclusions[index] === "diffDetected",
    );

    const screenshotDiffs = diffDetectedBuildIds.length
      ? await ScreenshotDiff.query()
          .select("buildId", "validationStatus")
          .whereIn("buildId", diffDetectedBuildIds)
          .groupBy("buildId", "validationStatus")
      : [];

    return buildIds.map((buildId, index) => {
      if (conclusions[index] !== "diffDetected") {
        return null;
      }

      const status = screenshotDiffs
        .filter((diff) => diff.buildId === buildId)
        .map(({ validationStatus }) => validationStatus);

      if (status.length === 1 && status[0] === "accepted") {
        return "accepted";
      }

      if (status.includes("rejected")) {
        return "rejected";
      }

      return null;
    });
  }

  static getUsers(buildId: string, { trx }: { trx?: TransactionOrKnex } = {}) {
    return User.query(trx)
      .leftJoinRelated(
        "[account.projects.builds, teams.account.projects.builds]",
      )
      .where("account:projects:builds.id", buildId)
      .orWhere("teams:account:projects:builds.id", buildId);
  }

  getUsers(options?: { trx?: TransactionOrKnex }) {
    return Build.getUsers(this.id, options);
  }

  async getUrl({ trx }: { trx?: TransactionOrKnex } = {}) {
    const project =
      this.project ??
      (await this.$relatedQuery("project", trx).withGraphFetched("account"));

    if (!project?.account) {
      throw new Error("Account not found");
    }

    const pathname = `/${project.account.slug}/${project.name}/builds/${this.number}`;

    return `${config.get("server.url")}${pathname}`;
  }

  static async getAggregatedBuildStatuses(builds: Build[]) {
    const buildIds = builds.map((build) => build.id);
    const statuses = await Build.getStatuses(builds);
    const conclusions = await Build.getConclusions(buildIds, statuses);
    const reviewStatuses = await Build.getReviewStatuses(buildIds, conclusions);
    return builds.map(
      (_build, index) =>
        reviewStatuses[index] || conclusions[index] || statuses[index],
    ) as BuildAggregatedStatus[];
  }
}
