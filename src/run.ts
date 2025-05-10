import * as core from "@actions/core";
import * as github from "./github";
import * as lib from "./lib";
import * as type from "./type";
import { z } from "zod";

export const main = async () => {
  run({
    githubToken: core.getInput("github_token"),
    trustedApps: new Set<string>(core.getMultilineInput("trusted_apps")),
    untrustedMachineUsers: new Set<string>(
      core.getMultilineInput("untrusted_machine_users"),
    ),
    repositoryOwner: core.getInput("repository_owner"),
    repositoryName: core.getInput("repository_name"),
    pullRequestNumber: parseInt(core.getInput("pull_request_number"), 10),
    // postComment: core.getBooleanInput("post_comment"),
  });
};

const getPullRequest = async (input: lib.Input): Promise<type.PullRequest> => {
  const result = await github.getPullRequest(input);
  const pr = type.PullRequest.parse(result);
  return pr;
};

const listCommits = async (
  input: lib.Input,
): Promise<type.PullRequestCommit[]> => {
  const result = await github.listCommits(input);
  const pr = type.PullRequest.parse(result);
  return pr.repository.pullRequest.commits.nodes;
};

const listReviews = async (input: lib.Input): Promise<type.Review[]> => {
  const result = await github.listReviews(input);
  const pr = type.PullRequest.parse(result);
  return pr.repository.pullRequest.reviews.nodes;
};

const run = async (input: lib.Input) => {
  core.info(
    JSON.stringify({
      trustedApps: [...input.trustedApps],
      untrustedMachineUsers: [...input.untrustedMachineUsers],
      repositoryOwner: input.repositoryOwner,
      repositoryName: input.repositoryName,
      pullRequestNumber: input.pullRequestNumber,
    }),
  );
  // Get a pull request reviews and committers via GraphQL API
  const pr = await getPullRequest(input);
  if (pr.repository.pullRequest.commits.pageInfo.hasNextPage) {
    pr.repository.pullRequest.commits.nodes = await listCommits(input);
  }
  if (pr.repository.pullRequest.reviews.pageInfo.hasNextPage) {
    pr.repository.pullRequest.reviews.nodes = await listReviews(input);
  }
  core.info(JSON.stringify(pr, null, 2));
  const result = analyze(pr, input);
  core.info(JSON.stringify(result, null, 2));
  if (!result.valid) {
    core.setFailed(result.message ?? "Validation failed");
  }
};

type Result = {
  headSHA: string;
  author: User;
  trustedApprovals: Approval[];
  ignoredApprovals: Approval[];
  untrustedCommits: Commit[];
  twoApprovalsAreRequired: boolean;
  valid: boolean;
  message?: string;
};

type Commit = {
  author?: User;
  committer?: User;
  sha: string;
  message: string;
};

type Approval = {
  user: User;
  message?: string;
};

type User = {
  login: string;
  untrusted?: boolean;
  message?: string;
};

const analyze = (pr: type.PullRequest, input: lib.Input): Result => {
  const approvals = analyzeReviews(pr, input);
  const untrustedCommits = analyzeCommits(pr, input);
  const author = {
    login: pr.repository.pullRequest.author.login,
    untrusted: checkIfUserRequiresTwoApprovals(
      pr.repository.pullRequest.author,
      input,
    ),
  };

  const result: Result = {
    headSHA: pr.repository.pullRequest.headRefOid,
    trustedApprovals: approvals.trusted,
    ignoredApprovals: approvals.ignored,
    untrustedCommits: untrustedCommits,
    twoApprovalsAreRequired: untrustedCommits.length > 0 || author.untrusted,
    author: author,
    valid: true,
  };

  if (approvals.trusted.length === 0) {
    result.valid = false;
    result.message = "At least one approval is required";
  }
  if (approvals.trusted.length === 1 && result.twoApprovalsAreRequired) {
    result.valid = false;
    result.message = "At least two approvals are required";
  }

  return result;
};

type Approvals = {
  trusted: Approval[];
  ignored: Approval[];
};

const analyzeCommit = (
  pr: type.PullRequest,
  input: lib.Input,
  commit: type.Commit,
): Commit | undefined => {
  if (commit.committer.user === null || commit.committer.user.login === "") {
    if (commit.author.user === null || commit.author.user.login === "") {
      return {
        sha: commit.oid,
        message: "a commit isn't linked to any GitHub user",
      };
    }
    return validateCommitter(commit, commit.author.user, input);
  }
  return validateCommitter(commit, commit.committer.user, input);
};

const analyzeCommits = (pr: type.PullRequest, input: lib.Input): Commit[] => {
  const untrustedCommits: Commit[] = [];
  for (const commit of pr.repository.pullRequest.commits.nodes) {
    const result = analyzeCommit(pr, input, commit.commit);
    if (result !== undefined) {
      untrustedCommits.push(result);
    }
  }
  return untrustedCommits;
};

const analyzeReviews = (pr: type.PullRequest, input: lib.Input): Approvals => {
  const approvals: Approvals = {
    trusted: [],
    ignored: [],
  };
  for (const review of extractApproved(
    excludeOldReviews(
      pr.repository.pullRequest.reviews.nodes,
      pr.repository.pullRequest.headRefOid,
    ),
  )) {
    if (isApp(review.author)) {
      approvals.ignored.push({
        user: {
          login: review.author.login,
        },
        message: "approval from app is ignored",
      });
      continue;
    }
    if (input.untrustedMachineUsers.has(review.author.login)) {
      approvals.ignored.push({
        user: {
          login: review.author.login,
        },
        message: "approval from untrusted machine user is ignored",
      });
      continue;
    }
    approvals.trusted.push({
      user: {
        login: review.author.login,
      },
    });
  }
  return approvals;
};

const validateCommitter = (
  commit: type.Commit,
  user: type.User,
  input: lib.Input,
): Commit | undefined => {
  if (isApp(user)) {
    return input.trustedApps.add(user.login)
      ? undefined
      : {
          sha: commit.oid,
          committer: {
            login: user.login,
            untrusted: true,
            message: "untrusted app",
          },
          message: "the committer is an untrusted app",
        };
  }
  return input.untrustedMachineUsers.has(user.login)
    ? {
        sha: commit.oid,
        committer: {
          login: user.login,
          untrusted: true,
          message: "untrusted machine user",
        },
        message: "the committer is an untrusted machine user",
      }
    : undefined;
};

const isApp = (user: type.User): boolean =>
  user.resourcePath.startsWith("/apps/") || user.login.endsWith("[bot]");

const extractApproved = (reviews: type.Review[]): type.Review[] =>
  reviews.filter((review) => review.state === "APPROVED");

const excludeOldReviews = (
  reviews: type.Review[],
  headRefOid: string,
): type.Review[] =>
  reviews.filter((review) => review.commit.oid !== headRefOid);

// checkIfUserRequiresTwoApprovals checks if the user requires two approvals.
// It returns true if the user is an untrusted app or machine user.
const checkIfUserRequiresTwoApprovals = (
  user: type.User | null,
  input: lib.Input,
): boolean => {
  if (user === null || user.login === "") {
    // If the user is not linked to any GitHub user, require two approvals
    return true;
  }
  if (isApp(user)) {
    // Require two approvals for PRs created by trusted apps, excluding trusted apps
    return !input.trustedApps.has(user.login);
  }
  // Require two approvals for PRs created by untrusted machine users
  return input.untrustedMachineUsers.has(user.login);
};
