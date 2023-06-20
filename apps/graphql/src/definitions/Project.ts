import { GraphQLError } from "graphql";
import gqlTag from "graphql-tag";
import type { PartialModelObject } from "objection";

import {
  Account,
  Build,
  GithubAccount,
  GithubRepository,
  Project,
  Screenshot,
  ScreenshotDiff,
  Test,
  User,
  VercelConfiguration,
} from "@argos-ci/database/models";
import { getTokenOctokit } from "@argos-ci/github";

import { IPermission, IResolvers } from "../__generated__/resolver-types.js";
import { deleteProject, getWritableProject } from "../services/project.js";
import { paginateResult } from "./PageInfo.js";
import { linkVercelProject } from "./Vercel.js";

// eslint-disable-next-line import/no-named-as-default-member
const { gql } = gqlTag;

export const typeDefs = gql`
  type GithubRepository implements Node {
    id: ID!
    defaultBranch: String!
    private: Boolean!
  }

  type Project implements Node {
    id: ID!
    name: String!
    token: String
    "Builds associated to the repository"
    builds(first: Int = 30, after: Int = 0): BuildConnection!
    "A single build linked to the repository"
    build(number: Int!): Build
    "Tests associated to the repository"
    tests(first: Int!, after: Int!): TestConnection!
    "Determine if the current user has write access to the project"
    permissions: [Permission!]!
    "Owner of the repository"
    account: Account!
    "Repositories associated to the project"
    ghRepository: GithubRepository
    "Override branch name"
    baselineBranch: String
    "Reference branch"
    referenceBranch: String
    "Check if the project is public or not"
    public: Boolean!
    "Override repository's Github privacy"
    private: Boolean
    "Current month used screenshots"
    currentMonthUsedScreenshots: Int!
    "Total screenshots used"
    totalScreenshots: Int!
    "Vercel project"
    vercelProject: VercelProject
  }

  extend type Query {
    "Get a project"
    project(accountSlug: String!, projectName: String!): Project
    "Get a project"
    projectById(id: ID!): Project
  }

  type ProjectConnection implements Connection {
    pageInfo: PageInfo!
    edges: [Project!]!
  }

  input CreateProjectInput {
    repo: String!
    owner: String!
    accountSlug: String!
  }

  input UpdateProjectInput {
    id: ID!
    baselineBranch: String
    private: Boolean
    name: String
  }

  input TransferProjectInput {
    id: ID!
    name: String!
    targetAccountId: ID!
  }

  input UnlinkRepositoryInput {
    projectId: ID!
  }

  input LinkRepositoryInput {
    projectId: ID!
    repo: String!
    owner: String!
  }

  input UnlinkVercelProjectInput {
    projectId: ID!
  }

  input LinkVercelProjectInput {
    projectId: ID!
    configurationId: ID!
    vercelProjectId: ID!
  }

  extend type Mutation {
    "Create a Project"
    createProject(input: CreateProjectInput!): Project!
    "Update Project"
    updateProject(input: UpdateProjectInput!): Project!
    "Unlink Repository"
    unlinkRepository(input: UnlinkRepositoryInput!): Project!
    "Link Repository"
    linkRepository(input: LinkRepositoryInput!): Project!
    "Link Vercel project"
    linkVercelProject(input: LinkVercelProjectInput!): Project!
    "Unlink Vercel project"
    unlinkVercelProject(input: UnlinkVercelProjectInput!): Project!
    "Transfer Project to another account"
    transferProject(input: TransferProjectInput!): Project!
    "Delete Project"
    deleteProject(id: ID!): Boolean!
  }
`;

const resolveProjectName = async (args: {
  name: string;
  accountId: string;
  index?: number;
}): Promise<string> => {
  const index = args.index || 0;
  const name = args.index ? `${args.name}-${index}` : args.name;

  const existingProject = await Project.query()
    .select("id")
    .findOne({ name, accountId: args.accountId })
    .first();

  if (!existingProject) {
    return name;
  }

  return resolveProjectName({ ...args, index: index + 1 });
};

const checkProjectName = async (args: { name: string; accountId: string }) => {
  const sameName = await Project.query()
    .select("id")
    .findOne({ name: args.name, accountId: args.accountId })
    .first();
  if (sameName) {
    throw new GraphQLError("Name is already used by another project", {
      extensions: {
        code: "BAD_USER_INPUT",
        field: "name",
      },
    });
  }
};

const getOrCreateGithubRepository = async (props: {
  accessToken: string;
  repo: string;
  owner: string;
}) => {
  const octokit = getTokenOctokit(props.accessToken);
  const ghApiRepo = await octokit.repos
    .get({
      owner: props.owner,
      repo: props.repo,
    })
    .then((res) => res.data);
  if (!ghApiRepo) {
    throw new Error("Repository not found");
  }

  const getOrCreateAccount = async () => {
    const account = await GithubAccount.query().findOne({
      githubId: ghApiRepo.owner.id,
    });
    if (account) {
      return account;
    }
    return GithubAccount.query().insertAndFetch({
      githubId: ghApiRepo.owner.id,
      login: ghApiRepo.owner.login,
      type: ghApiRepo.owner.type.toLowerCase() as "user" | "organization",
      name: ghApiRepo.owner.name ?? null,
    });
  };

  const githubAccount = await getOrCreateAccount();
  const repo = await GithubRepository.query().findOne({
    githubId: ghApiRepo.id,
  });
  if (repo) {
    return repo;
  }
  return GithubRepository.query().insertAndFetch({
    githubId: ghApiRepo.id,
    name: ghApiRepo.name,
    private: ghApiRepo.private,
    defaultBranch: ghApiRepo.default_branch,
    githubAccountId: githubAccount.id,
  });
};

export const createProject = async (props: {
  accountSlug: string;
  repo: string;
  owner: string;
  creator: User;
}) => {
  const account = await Account.query()
    .findOne({
      slug: props.accountSlug,
    })
    .throwIfNotFound();
  const hasWritePermission = await account.$checkWritePermission(props.creator);
  if (!hasWritePermission) {
    throw new Error("Unauthorized");
  }

  const ghRepo = await getOrCreateGithubRepository({
    accessToken: props.creator.accessToken,
    repo: props.repo,
    owner: props.owner,
  });

  const name = await resolveProjectName({
    name: ghRepo.name,
    accountId: account.id,
  });
  return Project.query().insertAndFetch({
    name,
    accountId: account.id,
    githubRepositoryId: ghRepo.id,
  });
};

export const resolvers: IResolvers = {
  Project: {
    token: async (project, _args, ctx) => {
      if (!ctx.auth) return null;
      const hasWritePermission = await project.$checkWritePermission(
        ctx.auth.user
      );
      if (!hasWritePermission) return null;
      return project.token;
    },
    builds: async (project, { first, after }) => {
      const result = await Build.query()
        .where({ projectId: project.id })
        .orderBy([
          { column: "createdAt", order: "desc" },
          { column: "number", order: "desc" },
        ])
        .range(after, after + first - 1);

      return paginateResult({ result, first, after });
    },
    build: async (project, args) => {
      const build = await Build.query().findOne({
        projectId: project.id,
        number: args.number,
      });
      return build ?? null;
    },
    tests: async (project, { first, after }) => {
      const result = await Test.query()
        .where("projectId", project.id)
        .whereNot((builder) =>
          builder.whereRaw(`"name" ~ :regexp`, {
            regexp: ScreenshotDiff.screenshotFailureRegexp,
          })
        )
        .orderByRaw(
          `(select "stabilityScore" from screenshot_diffs where screenshot_diffs."testId" = tests.id order by "id" desc limit 1) asc nulls last`
        )
        .range(after, after + first - 1);

      return paginateResult({ result, first, after });
    },
    permissions: async (project, _args, ctx) => {
      if (!ctx.auth) return [IPermission.Read];
      const hasWritePermission = await project.$checkWritePermission(
        ctx.auth.user
      );
      return hasWritePermission
        ? [IPermission.Read, IPermission.Write]
        : [IPermission.Read];
    },
    account: async (project, _args, ctx) => {
      return ctx.loaders.Account.load(project.accountId);
    },
    ghRepository: async (project, _args, ctx) => {
      if (!project.githubRepositoryId) return null;
      return ctx.loaders.GithubRepository.load(project.githubRepositoryId);
    },
    vercelProject: async (project, _args, ctx) => {
      if (!project.vercelProjectId) return null;
      return ctx.loaders.VercelProject.load(project.vercelProjectId);
    },
    referenceBranch: async (project) => {
      return project.$getReferenceBranch();
    },
    public: async (project, _args, ctx) => {
      project.githubRepository = project.githubRepositoryId
        ? await ctx.loaders.GithubRepository.load(project.githubRepositoryId)
        : null;
      return project.$checkIsPublic();
    },
    currentMonthUsedScreenshots: async (project, _args, ctx) => {
      const account = await ctx.loaders.Account.load(project.accountId);
      return account.$getScreenshotsCurrentConsumption({
        projectId: project.id,
      });
    },
    totalScreenshots: async (project) => {
      return Screenshot.query()
        .joinRelated("screenshotBucket")
        .where("screenshotBucket.projectId", project.id)
        .resultSize();
    },
  },
  Query: {
    project: async (_root, args, ctx) => {
      const project = await Project.query().joinRelated("account").findOne({
        "account.slug": args.accountSlug,
        "projects.name": args.projectName,
      });

      if (!project) return null;

      const hasReadPermission = await project.$checkReadPermission(
        ctx.auth?.user ?? null
      );
      if (!hasReadPermission) return null;

      return project;
    },
    projectById: async (_root, args, ctx) => {
      const project = await Project.query()
        .joinRelated("account")
        .findById(args.id);

      if (!project) return null;

      const hasReadPermission = await project.$checkReadPermission(
        ctx.auth?.user ?? null
      );
      if (!hasReadPermission) return null;

      return project;
    },
  },
  Mutation: {
    createProject: async (_root, args, ctx) => {
      if (!ctx.auth) {
        throw new Error("Unauthorized");
      }
      return createProject({
        accountSlug: args.input.accountSlug,
        repo: args.input.repo,
        owner: args.input.owner,
        creator: ctx.auth.user,
      });
    },
    updateProject: async (_root, args, ctx) => {
      const project = await getWritableProject({
        id: args.input.id,
        user: ctx.auth?.user,
      });

      const data: PartialModelObject<Project> = {};

      if (args.input.baselineBranch !== undefined) {
        data.baselineBranch = args.input.baselineBranch ?? null;
      }

      if (args.input.private !== undefined) {
        data.private = args.input.private;
      }

      if (args.input.name != null && project.name !== args.input.name) {
        await checkProjectName({
          name: args.input.name,
          accountId: project.accountId,
        });
        data.name = args.input.name;
      }

      return project.$query().patchAndFetch(data);
    },
    unlinkRepository: async (_root, args, ctx) => {
      const project = await getWritableProject({
        id: args.input.projectId,
        user: ctx.auth?.user,
      });

      return project.$query().patchAndFetch({
        githubRepositoryId: null,
      });
    },
    linkRepository: async (_root, args, ctx) => {
      if (!ctx.auth) {
        throw new Error("Unauthorized");
      }

      const project = await getWritableProject({
        id: args.input.projectId,
        user: ctx.auth.user,
      });

      const ghRepo = await getOrCreateGithubRepository({
        accessToken: ctx.auth.user.accessToken,
        owner: args.input.owner,
        repo: args.input.repo,
      });

      return project.$query().patchAndFetch({
        githubRepositoryId: ghRepo.id,
      });
    },
    linkVercelProject: async (_root, args, ctx) => {
      if (!ctx.auth) {
        throw new Error("Unauthorized");
      }

      const vercelConfiguration = await VercelConfiguration.query()
        .findById(args.input.configurationId)
        .throwIfNotFound();

      if (!vercelConfiguration.vercelAccessToken) {
        throw new Error("Invariant: Vercel access token is missing");
      }

      await linkVercelProject({
        vercelProjectId: args.input.vercelProjectId,
        projectId: args.input.projectId,
        creator: ctx.auth.user,
        vercelConfiguration,
        vercelAccessToken: vercelConfiguration.vercelAccessToken,
      });

      return Project.query().findById(args.input.projectId).throwIfNotFound();
    },
    unlinkVercelProject: async (_root, args, ctx) => {
      const project = await getWritableProject({
        id: args.input.projectId,
        user: ctx.auth?.user,
      });

      return project.$query().patchAndFetch({
        vercelProjectId: null,
      });
    },
    transferProject: async (_root, args, ctx) => {
      const project = await getWritableProject({
        id: args.input.id,
        user: ctx.auth?.user,
      });
      const { targetAccountId } = args.input;
      if (project.accountId === targetAccountId) {
        throw new Error("Project is already owned by this account");
      }
      await checkProjectName({
        name: args.input.name,
        accountId: targetAccountId,
      });
      return project.$query().patchAndFetch({
        accountId: targetAccountId,
        name: args.input.name,
      });
    },
    deleteProject: async (_root, args, ctx) => {
      await deleteProject({ id: args.id, user: ctx.auth?.user });
      return true;
    },
  },
};
