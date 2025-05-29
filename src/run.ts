import * as core from "@actions/core";
import * as github from "./github";
import * as lib from "./lib";
import * as type from "./type";

export const main = async () => {
  run(
    parseInput({
      githubToken: core.getInput("github_token"),
      repositoryOwner: core.getInput("repository_owner"),
      repositoryName: core.getInput("repository_name"),
      pullRequestNumber: core.getInput("pull_request_number"),
      trustedApps: core.getMultilineInput("trusted_apps"),
      trustedMachineUsers: core.getMultilineInput("trusted_machine_users"),
      untrustedMachineUsers: core.getMultilineInput("untrusted_machine_users"),
    }),
  );
};

const parseInput = (rawInput: lib.RawInput): lib.Input => {
  const trustedApps = new Set<string>();
  for (const app of rawInput.trustedApps.filter((a) => !a.startsWith("#"))) {
    if (app.endsWith("[bot]")) {
      throw new Error("Each line of trusted_apps must not end with [bot]");
    }
    if (app.includes("/")) {
      throw new Error("Each line of trusted_apps must not include /");
    }
    trustedApps.add("/apps/" + app);
  }
  const untrustedMachineUsers = new Set<string>();
  const untrustedMachineUserRegexps: RegExp[] = [];
  for (const user of rawInput.untrustedMachineUsers.filter(
    (a) => !a.startsWith("#"),
  )) {
    if (user.startsWith("/") && user.endsWith("/")) {
      untrustedMachineUserRegexps.push(new RegExp(user.slice(1, -1)));
      continue;
    }
    untrustedMachineUsers.add(user);
  }
  return {
    githubToken: rawInput.githubToken,
    trustedApps: trustedApps,
    trustedMachineUsers: new Set(
      rawInput.trustedMachineUsers.filter((a) => !a.startsWith("#")),
    ),
    untrustedMachineUsers: untrustedMachineUsers,
    untrustedMachineUserRegexps: untrustedMachineUserRegexps,
    repositoryOwner: rawInput.repositoryOwner,
    repositoryName: rawInput.repositoryName,
    pullRequestNumber: parseInt(rawInput.pullRequestNumber, 10),
  };
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
    JSON.stringify(
      {
        trustedApps: [...input.trustedApps],
        trustedMachineUsers: [...input.trustedMachineUsers],
        untrustedMachineUsers: [...input.untrustedMachineUsers],
        untrustedMachineUserRegExps: [
          ...input.untrustedMachineUserRegexps.map((r) => r.toString()),
        ],
        repositoryOwner: input.repositoryOwner,
        repositoryName: input.repositoryName,
        pullRequestNumber: input.pullRequestNumber,
      },
      null,
      2,
    ),
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
    core.setFailed(
      `${result.message ?? "Validation failed"}: https://github.com/suzuki-shunsuke/validate-pr-review-action/blob/main/README.md`,
    );
  }
};

type Result = {
  headSHA: string;
  author: User;
  trustedApprovals: Approval[];
  ignoredApprovals: Approval[];
  approvalsFromCommitters: Approval[];
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

export const analyze = (pr: type.PullRequest, input: lib.Input): Result => {
  const untrustedCommits = analyzeCommits(pr, input);
  const approvals = analyzeReviews(pr, input, untrustedCommits.committers);
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
    approvalsFromCommitters: approvals.approvalsFromCommitters,
    untrustedCommits: untrustedCommits.untrusted,
    twoApprovalsAreRequired:
      untrustedCommits.untrusted.length > 0 ||
      author.untrusted ||
      approvals.approvalsFromCommitters.length > 0,
    author: author,
    valid: true,
  };

  const numOfApprovals =
    result.trustedApprovals.length + result.approvalsFromCommitters.length;
  if (numOfApprovals < 2 && result.twoApprovalsAreRequired) {
    result.valid = false;
    result.message = "At least two approvals are required";
    return result;
  }
  if (numOfApprovals === 0) {
    result.valid = false;
    result.message = "At least one approval is required";
  }

  return result;
};

type Approvals = {
  trusted: Approval[];
  ignored: Approval[];
  approvalsFromCommitters: Approval[];
};

const analyzeCommit = (
  pr: type.PullRequest,
  input: lib.Input,
  commit: type.Commit,
  committer: type.User | undefined,
): Commit | undefined => {
  if (committer === undefined) {
    return {
      sha: commit.oid,
      message: "a commit isn't linked to any GitHub user",
    };
  }
  return validateCommitter(commit, committer, input);
};

const getCommitter = (commit: type.Commit): type.User | undefined => {
  if (commit.committer.user === null || commit.committer.user.login === "") {
    if (commit.author.user === null || commit.author.user.login === "") {
      return undefined;
    }
    return commit.author.user;
  }
  return commit.committer.user;
};

type Commits = {
  untrusted: Commit[];
  committers: Set<string>;
};

const analyzeCommits = (pr: type.PullRequest, input: lib.Input): Commits => {
  const commits: Commits = {
    untrusted: [],
    committers: new Set(),
  };
  for (const commit of pr.repository.pullRequest.commits.nodes) {
    const committer = getCommitter(commit.commit);
    if (committer !== undefined) {
      commits.committers.add(committer.login);
    }
    const result = analyzeCommit(pr, input, commit.commit, committer);
    if (result !== undefined) {
      commits.untrusted.push(result);
    }
  }
  return commits;
};

const matchUntrustedMachineUser = (
  login: string,
  input: lib.Input,
): boolean => {
  if (input.trustedMachineUsers.has(login)) {
    return false;
  }
  if (input.untrustedMachineUsers.has(login)) {
    return true;
  }
  for (const regexp of input.untrustedMachineUserRegexps) {
    if (regexp.test(login)) {
      return true;
    }
  }
  return false;
};

export const analyzeReviews = (
  pr: type.PullRequest,
  input: lib.Input,
  committers: Set<string>,
): Approvals => {
  const approvals: Approvals = {
    trusted: [],
    ignored: [],
    approvalsFromCommitters: [],
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
    if (matchUntrustedMachineUser(review.author.login, input)) {
      approvals.ignored.push({
        user: {
          login: review.author.login,
        },
        message: "approval from untrusted machine user is ignored",
      });
      continue;
    }
    if (committers.has(review.author.login)) {
      approvals.approvalsFromCommitters.push({
        user: {
          login: review.author.login,
        },
        message: "approval from committer requires two approvals",
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
    return input.trustedApps.has(user.resourcePath)
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
  return matchUntrustedMachineUser(user.login, input)
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
  user.resourcePath.startsWith("/apps/");

const extractApproved = (reviews: type.Review[]): type.Review[] =>
  reviews.filter((review) => review.state === "APPROVED");

const excludeOldReviews = (
  reviews: type.Review[],
  headRefOid: string,
): type.Review[] =>
  reviews.filter((review) => review.commit.oid === headRefOid);

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
    return !input.trustedApps.has(user.resourcePath);
  }
  // Require two approvals for PRs created by untrusted machine users
  return matchUntrustedMachineUser(user.login, input);
};
