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
        trustedApps: new Set(["renovate[bot]", "dependabot[bot]"]),
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
        trustedApps: new Set(["renovate[bot]", "dependabot[bot]"]),
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
