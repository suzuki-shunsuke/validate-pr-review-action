import * as core from "@actions/core";
import * as github from "./github";
import * as lib from "./lib";
import * as type from "./type";
import { z } from "zod";

export const main = async () => {
  run({
    githubToken: core.getInput("github_token"),
    trustedApps: new Set(core.getMultilineInput("trusted_apps")),
    untrustedMachineUsers: new Set(
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
  core.debug(`pull request: ${JSON.stringify(result)}`);
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
  // Get a pull request reviews and committers via GraphQL API
  const pr = await getPullRequest(input);
  if (pr.repository.pullRequest.commits.pageInfo.hasNextPage) {
    pr.repository.pullRequest.commits.nodes = await listCommits(input);
  }
  if (pr.repository.pullRequest.reviews.pageInfo.hasNextPage) {
    pr.repository.pullRequest.reviews.nodes = await listReviews(input);
  }
  const reviews = ignoreUntrustedReviews(
    filterReviews(
      pr.repository.pullRequest.reviews.nodes,
      pr.repository.pullRequest.headRefOid,
    ),
    input.untrustedMachineUsers,
  );
  if (reviews.length > 1) {
    // Allow multiple approvals
    return;
  }
  if (reviews.length === 0) {
    // Approval is required
    core.setFailed("Approval is required");
    return;
  }

  const requiredTwoApprovals = checkIfTwoApprovalsRequired(pr, input);
  if (requiredTwoApprovals) {
    if (reviews.length === 1) {
      core.setFailed("Two approvals are required");
      return;
    }
  }

  const committers = getCommitters(pr.repository.pullRequest.commits.nodes);
  validate(reviews, committers, requiredTwoApprovals);
};

const ignoreUntrustedReviews = (
  reviews: type.Review[],
  untrustedUsers: Set<string>,
): type.Review[] => {
  // Ignore approvals from untrusted users
  return reviews.filter((review) => !untrustedUsers.has(review.author.login));
};

const isApp = (user: type.User): boolean => {
  return user.resourcePath.startsWith("/apps/") || user.login.endsWith("[bot]");
};

const filterReviews = (
  reviews: type.Review[],
  headRefOid: string,
): type.Review[] => {
  return reviews.filter((review) => {
    if (review.state !== "APPROVED" || review.commit.oid !== headRefOid) {
      // Ignore reviews other than APPROVED
      // Ignore reviews for non head commits
      return false;
    }
    if (isApp(review.author)) {
      // Ignore approvals from bots
      return false;
    }
    return true;
  });
};

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

const checkIfTwoApprovalsRequired = (
  pr: type.PullRequest,
  input: lib.Input,
): boolean => {
  if (
    checkIfUserRequiresTwoApprovals(pr.repository.pullRequest.author, input)
  ) {
    return true;
  }
  // If the pull request has commits from untrusted apps or machine users, require two approvals
  for (const commit of pr.repository.pullRequest.commits.nodes) {
    const user = commit.commit.author.user;
    if (checkIfUserRequiresTwoApprovals(user, input)) {
      return true;
    }
  }
  return false;
};

const getUserFromCommit = (commit: type.Commit): type.User | null => {
  return commit.committer.user ?? commit.author.user;
};

const getCommitters = (commits: type.PullRequestCommit[]): Set<string> => {
  const committers = new Set<string>();
  for (const commit of commits) {
    const user = getUserFromCommit(commit.commit);
    if (user === null || user.login === "") {
      continue;
    }
    committers.add(user.login);
  }
  return committers;
};

const validate = (
  reviews: type.Review[],
  committers: Set<string>,
  requiredTwoApprovals: boolean,
) => {
  let oneApproval = false;
  for (const review of reviews) {
    // TODO check CODEOWNERS
    if (committers.has(review.author.login)) {
      // self-approve
      continue;
    }
    if (!requiredTwoApprovals || oneApproval) {
      // Someone other than committers approved the PR, so this PR is not self-approved.
      return;
    }
    oneApproval = true;
  }
  if (oneApproval) {
    throw new Error("Two approvals are required");
  }
  throw new Error("Approval is required");
};
