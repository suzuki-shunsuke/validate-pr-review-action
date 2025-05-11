import { expect, test } from "vitest";
import * as run from "./run";
import * as lib from "./lib";
import { get } from "http";

const latestSHA = "1234567890abcdef1234567890abcdef12345678";
const oldSHA = "0000000000000000000000000000000000000000";
const octocat = {
  login: "octocat",
  resourcePath: "/octocat",
};
const suzuki = {
  login: "suzuki-shunsuke",
  resourcePath: "/suzuki-shunsuke",
};
const renovate = {
  login: "renovate",
  resourcePath: "/apps/renovate",
};
const suzukiBot = {
  login: "suzuki-shunsuke-bot",
  resourcePath: "/suzuki-shunsuke-bot",
};
const untrustedApp = {
  login: "suzuki-shunsuke-app",
  resourcePath: "/apps/suzuki-shunsuke-app",
};
const pageInfo = {
  hasNextPage: false,
  endCursor: "",
};

const getInput = (
  trustedApps: string[],
  untrustedMachineUsers: string[],
): lib.Input => ({
  githubToken: "",
  repositoryOwner: "suzuki-shunsuke",
  repositoryName: "validate-pr-review-action",
  pullRequestNumber: 1,
  trustedApps: new Set(trustedApps),
  untrustedMachineUsers: new Set(untrustedMachineUsers),
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

test("analyze - normal", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: latestSHA,
            author: octocat,
            commits: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  commit: octocatLatestCommit,
                },
              ],
            },
            reviews: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki,
                },
              ],
            },
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "octocat",
      untrusted: false,
    },
    trustedApprovals: [
      {
        user: {
          login: "suzuki-shunsuke",
        },
      },
    ],
    ignoredApprovals: [],
    untrustedCommits: [],
    twoApprovalsAreRequired: false,
    valid: true,
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
            commits: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  commit: {
                    oid: latestSHA,
                    committer: {
                      user: null,
                    },
                    author: {
                      user: renovate,
                    },
                  },
                },
              ],
            },
            reviews: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki,
                },
              ],
            },
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "renovate",
      untrusted: false,
    },
    trustedApprovals: [
      {
        user: {
          login: "suzuki-shunsuke",
        },
      },
    ],
    ignoredApprovals: [],
    untrustedCommits: [],
    twoApprovalsAreRequired: false,
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
            commits: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  commit: {
                    oid: latestSHA,
                    committer: {
                      user: null,
                    },
                    author: {
                      user: octocat,
                    },
                  },
                },
              ],
            },
            reviews: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki,
                },
              ],
            },
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
    trustedApprovals: [
      {
        user: {
          login: "suzuki-shunsuke",
        },
      },
    ],
    ignoredApprovals: [],
    untrustedCommits: [],
    twoApprovalsAreRequired: true,
    valid: false,
    message: "At least two approvals are required",
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
            commits: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  commit: {
                    oid: latestSHA,
                    committer: {
                      user: null,
                    },
                    author: {
                      user: {
                        login: "suzuki-shunsuke-2",
                        resourcePath: "/suzuki-shunsuke-2",
                      },
                    },
                  },
                },
              ],
            },
            reviews: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki,
                },
              ],
            },
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
    trustedApprovals: [
      {
        user: {
          login: "suzuki-shunsuke",
        },
      },
    ],
    ignoredApprovals: [],
    untrustedCommits: [],
    twoApprovalsAreRequired: true,
    valid: false,
    message: "At least two approvals are required",
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
            commits: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  commit: octocatLatestCommit,
                },
                {
                  commit: suzukiLatestCommit,
                },
              ],
            },
            reviews: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
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
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki, // ignore approvals from committers
                },
                {
                  state: "COMMENT", // ignore other than APPROVED
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki,
                },
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: untrustedApp, // ignore approvals from apps
                },
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzukiBot, // ignore approvals from untrusted machine users
                },
              ],
            },
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], ["suzuki-shunsuke-bot"]),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "octocat",
      untrusted: false,
    },
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
    twoApprovalsAreRequired: false,
    valid: false,
    message: "At least one approval is required",
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
            commits: {
              totalCount: 2,
              pageInfo: pageInfo,
              nodes: [
                {
                  commit: {
                    oid: latestSHA,
                    committer: {
                      user: octocat,
                    },
                    author: {
                      user: octocat,
                    },
                  },
                },
                {
                  commit: {
                    // not linked to any GitHub user
                    oid: latestSHA,
                    committer: {
                      user: null,
                    },
                    author: {
                      user: null,
                    },
                  },
                },
              ],
            },
            reviews: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki,
                },
              ],
            },
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
    ),
  ).toStrictEqual({
    headSHA: latestSHA,
    author: {
      login: "octocat",
      untrusted: false,
    },
    trustedApprovals: [
      {
        user: {
          login: "suzuki-shunsuke",
        },
      },
    ],
    ignoredApprovals: [],
    untrustedCommits: [
      {
        sha: latestSHA,
        message: "a commit isn't linked to any GitHub user",
      },
    ],
    twoApprovalsAreRequired: true,
    valid: false,
    message: "At least two approvals are required",
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
            commits: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  commit: {
                    oid: latestSHA,
                    committer: {
                      user: octocat,
                    },
                    author: {
                      user: octocat,
                    },
                  },
                },
              ],
            },
            reviews: {
              totalCount: 1,
              pageInfo: pageInfo,
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: latestSHA,
                  },
                  author: suzuki,
                },
              ],
            },
          },
        },
      },
      getInput(["/apps/renovate", "/apps/dependabot"], []),
      new Set(["octocat"]),
    ),
  ).toStrictEqual({
    trusted: [
      {
        user: {
          login: "suzuki-shunsuke",
        },
      },
    ],
    ignored: [],
  });
});
