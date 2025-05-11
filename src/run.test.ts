import { expect, test } from "vitest";
import * as run from "./run";
import * as lib from "./lib";
import * as type from "./type";

const latestSHA = "1234567890abcdef1234567890abcdef12345678";
const oldSHA = "0000000000000000000000000000000000000000";
const user = (user: string): type.User => ({
  login: user,
  resourcePath: `/${user}`,
});
const octocat = user("octocat");
const suzuki = user("suzuki-shunsuke");
const suzuki2 = user("suzuki-shunsuke-2");
const suzukiBot = user("suzuki-shunsuke-bot");
const app = (app: string): type.User => ({
  login: app,
  resourcePath: `/apps/${app}`,
});
const renovate = app("renovate");
const untrustedApp = app("suzuki-shunsuke-app");
const pageInfo = {
  hasNextPage: false,
  endCursor: "",
};

const getInput = (
  trustedApps: string[],
  untrustedMachineUsers: string[],
  trustedMachineUsers: string[] = [],
  untrustedMachineUserRegexps: string[] = [],
): lib.Input => ({
  githubToken: "",
  repositoryOwner: "suzuki-shunsuke",
  repositoryName: "validate-pr-review-action",
  pullRequestNumber: 1,
  trustedApps: new Set(trustedApps),
  trustedMachineUsers: new Set(trustedMachineUsers),
  untrustedMachineUsers: new Set(untrustedMachineUsers),
  untrustedMachineUserRegexps: untrustedMachineUserRegexps.map(
    (r) => new RegExp(r),
  ),
  minimumApprovals: 1,
});

const octocatLatestCommit = {
  oid: latestSHA,
  committer: {
    user: octocat,
  },
  author: {
    user: octocat,
  },
};

const suzukiLatestCommit = {
  oid: latestSHA,
  committer: {
    user: suzuki,
  },
  author: {
    user: suzuki,
  },
};

const renovateLatestCommit = {
  oid: latestSHA,
  committer: {
    user: null,
  },
  author: {
    user: renovate,
  },
};

const notLinkedLatestCommit = {
  oid: latestSHA,
  committer: {
    user: null,
  },
  author: {
    user: null,
  },
};

const commits = (commits: type.Commit[]) => {
  return {
    totalCount: commits.length,
    pageInfo: pageInfo,
    nodes: commits.map((commit) => ({
      commit: commit,
    })),
  };
};

const reviews = (reviews: type.Review[]) => {
  return {
    totalCount: commits.length,
    pageInfo: pageInfo,
    nodes: reviews,
  };
};

const latestApproval = (user: type.User) => ({
  state: "APPROVED",
  commit: {
    oid: latestSHA,
  },
  author: user,
});

const latestApprovalFromSuzuki = latestApproval(suzuki);
const latestApprovalFromSuzuki2 = latestApproval(suzuki2);

const trustedApproval = (user: string) => ({
  user: {
    login: user,
  },
});

const trustedApprovalFromSuzuki = trustedApproval("suzuki-shunsuke");
const trustedApprovalFromSuzuki2 = trustedApproval("suzuki-shunsuke-2");
const trustedApprovalFromOctocat = trustedApproval("octocat");

const authors = {
  octocat: {
    login: "octocat",
    untrusted: false,
  },
  renovate: {
    login: "renovate",
    untrusted: false,
  },
};

test("analyze - normal", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: octocat,
            commits: commits([octocatLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: authors.octocat,
    trustedApprovals: [trustedApprovalFromSuzuki],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 1,
    valid: true,
  });
});

test("analyze - at least 1 approval is required", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: octocat,
            commits: commits([octocatLatestCommit]),
            reviews: reviews([]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: authors.octocat,
    trustedApprovals: [],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 1,
    message: "At least 1 approval is required",
    valid: false,
  });
});

test("analyze - pr author is a trusted app", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: renovate, // trusted app
            commits: commits([renovateLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: authors.renovate,
    trustedApprovals: [trustedApprovalFromSuzuki],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 1,
    valid: true,
  });
});

test("analyze - pr author is an untrusted machine user", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: suzukiBot, // untrusted machine user
            commits: commits([octocatLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], ["suzuki-shunsuke-bot"]),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "suzuki-shunsuke-bot",
      untrusted: true,
    },
    trustedApprovals: [trustedApprovalFromSuzuki],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 2,
    valid: false,
    message: "At least 2 approvals are required",
  });
});

test("analyze - pr author is an untrusted machine user (regexp)", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: suzukiBot, // untrusted machine user
            commits: commits([octocatLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], [], [], ["-bot$"]),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "suzuki-shunsuke-bot",
      untrusted: true,
    },
    trustedApprovals: [trustedApprovalFromSuzuki],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 2,
    valid: false,
    message: "At least 2 approvals are required",
  });
});

test("analyze - trusted_machine_users", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: suzukiBot, // untrusted machine user
            commits: commits([octocatLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(
        ["/apps/renovate", "/apps/dependabot"],
        [],
        ["suzuki-shunsuke-bot"],
        ["-bot$"],
      ),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "suzuki-shunsuke-bot",
      untrusted: false,
    },
    trustedApprovals: [trustedApprovalFromSuzuki],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 1,
    valid: true,
  });
});

test("analyze - pr author is an untrusted machine user (2 approvals)", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: suzukiBot, // untrusted machine user
            commits: commits([octocatLatestCommit]),
            reviews: reviews([
              latestApprovalFromSuzuki,
              latestApprovalFromSuzuki2,
            ]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], ["suzuki-shunsuke-bot"]),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "suzuki-shunsuke-bot",
      untrusted: true,
    },
    trustedApprovals: [trustedApprovalFromSuzuki, trustedApprovalFromSuzuki2],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 2,
    valid: true,
  });
});

test("analyze - pr author is an untrusted app", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: untrustedApp, // untrusted app
            commits: commits([octocatLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "suzuki-shunsuke-app",
      untrusted: true,
    },
    trustedApprovals: [trustedApprovalFromSuzuki],
    ignoredApprovals: [],
    untrustedCommits: [],
    minimumApprovals: 2,
    valid: false,
    message: "At least 2 approvals are required",
  });
});

test("analyze - filter reviews", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: octocat,
            commits: commits([octocatLatestCommit, suzukiLatestCommit]),
            reviews: reviews([
              {
                state: "APPROVED",
                commit: {
                  oid: oldSHA, // ignore old approvals
                },
                author: {
                  login: "suzuki-shunsuke-2",
                  resourcePath: "/suzuki-shunsuke-2",
                },
              },
              latestApprovalFromSuzuki, // ignore approvals from committers
              {
                state: "COMMENT", // ignore other than APPROVED
                commit: {
                  oid: latestSHA,
                },
                author: suzuki,
              },
              latestApproval(untrustedApp), // ignore approvals from apps
              latestApproval(suzukiBot), // ignore approvals from untrusted machine users
            ]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], ["suzuki-shunsuke-bot"]),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: authors.octocat,
    trustedApprovals: [],
    ignoredApprovals: [
      {
        message: "approval from committer is ignored",
        user: {
          login: "suzuki-shunsuke",
        },
      },
      {
        message: "approval from app is ignored",
        user: {
          login: "suzuki-shunsuke-app",
        },
      },
      {
        message: "approval from untrusted machine user is ignored",
        user: {
          login: "suzuki-shunsuke-bot",
        },
      },
    ],
    untrustedCommits: [],
    minimumApprovals: 1,
    valid: false,
    message: "At least 1 approval is required",
  });
});

test("analyze - not linked user", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: octocat,
            commits: commits([octocatLatestCommit, notLinkedLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: authors.octocat,
    trustedApprovals: [trustedApprovalFromSuzuki],
    ignoredApprovals: [],
    untrustedCommits: [
      {
        sha: latestSHA,
        message: "a commit isn't linked to any GitHub user",
      },
    ],
    minimumApprovals: 2,
    valid: false,
    message: "At least 2 approvals are required",
  });
});

test("analyzeReviews - normal", () => {
  expect(
    run.analyzeReviews(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: octocat,
            commits: commits([octocatLatestCommit]),
            reviews: reviews([latestApprovalFromSuzuki]),
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
      new Set(["octocat"]),
    ),
  ).toStrictEqual({
    trusted: [trustedApprovalFromSuzuki],
    ignored: [],
  });
});
