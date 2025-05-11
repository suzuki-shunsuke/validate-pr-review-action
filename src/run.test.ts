import { expect, test } from "vitest";
import * as run from "./run";

test("analyze - normal", () => {
  expect(
    run.analyze(
      {
        repository: {
          pullRequest: {
            headRefOid: "1234567890abcdef1234567890abcdef12345678",
            author: {
              login: "octocat",
              resourcePath: "/octocat",
            },
            commits: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                    committer: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
                    },
                    author: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
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
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke",
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
              ],
            },
          },
        },
      },
      {
        trustedApps: new Set(["/apps/renovate", "/apps/dependabot"]),
        untrustedMachineUsers: new Set(),
        githubToken: "",
        repositoryOwner: "suzuki-shunsuke",
        repositoryName: "validate-pr-review-action",
        pullRequestNumber: 1,
      },
    ),
  ).toStrictEqual({
    headSHA: "1234567890abcdef1234567890abcdef12345678",
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
            headRefOid: "1234567890abcdef1234567890abcdef12345678",
            author: {
              login: "renovate", // trusted app
              resourcePath: "/apps/renovate",
            },
            commits: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                    committer: {
                      user: null,
                    },
                    author: {
                      user: {
                        login: "renovate",
                        resourcePath: "/apps/renovate",
                      },
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
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke",
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
              ],
            },
          },
        },
      },
      {
        trustedApps: new Set(["/apps/renovate", "/apps/dependabot"]),
        untrustedMachineUsers: new Set(),
        githubToken: "",
        repositoryOwner: "suzuki-shunsuke",
        repositoryName: "validate-pr-review-action",
        pullRequestNumber: 1,
      },
    ),
  ).toStrictEqual({
    headSHA: "1234567890abcdef1234567890abcdef12345678",
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
            headRefOid: "1234567890abcdef1234567890abcdef12345678",
            author: {
              login: "suzuki-shunsuke-bot", // untrusted machine user
              resourcePath: "/suzuki-shunsuke-bot",
            },
            commits: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
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
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke",
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
              ],
            },
          },
        },
      },
      {
        trustedApps: new Set(["/apps/renovate", "/apps/dependabot"]),
        untrustedMachineUsers: new Set(["suzuki-shunsuke-bot"]),
        githubToken: "",
        repositoryOwner: "suzuki-shunsuke",
        repositoryName: "validate-pr-review-action",
        pullRequestNumber: 1,
      },
    ),
  ).toStrictEqual({
    headSHA: "1234567890abcdef1234567890abcdef12345678",
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
            headRefOid: "1234567890abcdef1234567890abcdef12345678",
            author: {
              login: "suzuki-shunsuke-app", // untrusted app
              resourcePath: "/apps/suzuki-shunsuke-app",
            },
            commits: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                    committer: {
                      user: null,
                    },
                    author: {
                      user: {
                        login: "suzuki-shunsuke-2",
                        resourcePath: "/suzuki-shunsuke",
                      },
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
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke",
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
              ],
            },
          },
        },
      },
      {
        trustedApps: new Set(["/apps/renovate", "/apps/dependabot"]),
        untrustedMachineUsers: new Set(),
        githubToken: "",
        repositoryOwner: "suzuki-shunsuke",
        repositoryName: "validate-pr-review-action",
        pullRequestNumber: 1,
      },
    ),
  ).toStrictEqual({
    headSHA: "1234567890abcdef1234567890abcdef12345678",
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
            headRefOid: "1234567890abcdef1234567890abcdef12345678",
            author: {
              login: "octocat",
              resourcePath: "/octocat",
            },
            commits: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                    committer: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
                    },
                    author: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
                    },
                  },
                },
                {
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                    committer: {
                      user: {
                        login: "suzuki-shunsuke",
                        resourcePath: "/suzuki-shunsuke",
                      },
                    },
                    author: {
                      user: {
                        login: "suzuki-shunsuke",
                        resourcePath: "/suzuki-shunsuke",
                      },
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
                    oid: "0000000000000000000000000000000000000000", // ignore old approvals
                  },
                  author: {
                    login: "suzuki-shunsuke-2",
                    resourcePath: "/suzuki-shunsuke-2",
                  },
                },
                {
                  state: "APPROVED",
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke", // ignore approvals from committers
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
                {
                  state: "COMMENT", // ignore other than APPROVED
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke",
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
                {
                  state: "APPROVED",
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "github-actions",
                    resourcePath: "/apps/github-actions", // ignore approvals from apps
                  },
                },
                {
                  state: "APPROVED",
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke-bot",
                    resourcePath: "/suzuki-shunsuke-bot", // ignore approvals from untrusted machine users
                  },
                },
              ],
            },
          },
        },
      },
      {
        trustedApps: new Set(["/apps/renovate", "/apps/dependabot"]),
        untrustedMachineUsers: new Set(["suzuki-shunsuke-bot"]),
        githubToken: "",
        repositoryOwner: "suzuki-shunsuke",
        repositoryName: "validate-pr-review-action",
        pullRequestNumber: 1,
      },
    ),
  ).toStrictEqual({
    headSHA: "1234567890abcdef1234567890abcdef12345678",
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
          login: "github-actions",
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
            headRefOid: "1234567890abcdef1234567890abcdef12345678",
            author: {
              login: "octocat",
              resourcePath: "/octocat",
            },
            commits: {
              totalCount: 2,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  commit: {
                    oid: "1234567890abcdef123456789011111111111111",
                    committer: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
                    },
                    author: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
                    },
                  },
                },
                {
                  commit: {
                    // not linked to any GitHub user
                    oid: "1234567890abcdef1234567890abcdef12345678",
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
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  state: "APPROVED",
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke",
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
              ],
            },
          },
        },
      },
      {
        trustedApps: new Set(["/apps/renovate", "/apps/dependabot"]),
        untrustedMachineUsers: new Set(),
        githubToken: "",
        repositoryOwner: "suzuki-shunsuke",
        repositoryName: "validate-pr-review-action",
        pullRequestNumber: 1,
      },
    ),
  ).toStrictEqual({
    headSHA: "1234567890abcdef1234567890abcdef12345678",
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
        sha: "1234567890abcdef1234567890abcdef12345678",
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
            headRefOid: "1234567890abcdef1234567890abcdef12345678",
            author: {
              login: "octocat",
              resourcePath: "/octocat",
            },
            commits: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "",
              },
              nodes: [
                {
                  commit: {
                    oid: "1234567890abcdef1234567890abcdef12345678",
                    committer: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
                    },
                    author: {
                      user: {
                        login: "octocat",
                        resourcePath: "/octocat",
                      },
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
                    oid: "1234567890abcdef1234567890abcdef12345678",
                  },
                  author: {
                    login: "suzuki-shunsuke",
                    resourcePath: "/suzuki-shunsuke",
                  },
                },
              ],
            },
          },
        },
      },
      {
        trustedApps: new Set(["/apps/renovate", "/apps/dependabot"]),
        untrustedMachineUsers: new Set(),
        githubToken: "",
        repositoryOwner: "suzuki-shunsuke",
        repositoryName: "validate-pr-review-action",
        pullRequestNumber: 1,
      },
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
