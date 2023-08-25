import { getCommentHeader } from "@argos-ci/database";
import { Build, type BuildAggregatedStatus } from "@argos-ci/database/models";

import { getStatsMessage } from "./utils.js";

export const getBuildStatusLabel = (status: BuildAggregatedStatus): string => {
  switch (status) {
    case "accepted":
      return "👍 Changes approved";
    case "aborted":
      return "🙅 Build aborted";
    case "diffDetected":
      return "🧿 Changes detected";
    case "error":
      return "❌ An error happened";
    case "expired":
      return "💀 Build expired";
    case "pending":
      return "📭 Waiting for screenshots";
    case "progress":
      return "🚜 Diffing screenshots";
    case "rejected":
      return "👎 Changes rejected";
    case "stable":
      return "✅ No change detected";
    default:
      throw new Error("Unknown build status");
  }
};

const dateFormatter = Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const formatDate = (date: string): string => {
  const d = new Date(date);
  return dateFormatter.format(d);
};

export const getCommentBody = async (props: {
  commit: string;
}): Promise<string> => {
  const builds = await Build.query()
    .distinctOn("builds.name")
    .joinRelated("compareScreenshotBucket")
    .where("compareScreenshotBucket.commit", props.commit)
    .orderBy([
      { column: "name", order: "desc" },
      { column: "builds.number", order: "desc" },
    ]);

  const aggregateStatuses = await Build.getAggregatedBuildStatuses(builds);
  const buildRows = await Promise.all(
    builds.map(async (build, index) => {
      const [stats, url] = await Promise.all([
        getStatsMessage(build.id),
        build.getUrl(),
      ]);
      const status = aggregateStatuses[index];
      if (!status) {
        throw new Error("Invariant: unknown build status");
      }
      const statusMessage = getBuildStatusLabel(status);
      const review = status === "diffDetected" ? ` ([Review](${url}))` : "";
      return `| **${
        build.name
      }** ([Inspect](${url})) | ${statusMessage}${review} | ${
        stats || "-"
      } | ${formatDate(build.updatedAt)} |`;
    }),
  );
  return [
    getCommentHeader(),
    "",
    `| Build | Status | Details | Updated (UTC) |`,
    `| :---- | :----- | :------ | :------------ |`,
    ...buildRows.sort(),
  ].join("\n");
};