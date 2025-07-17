import * as github from "@actions/github";
import * as lib from "./lib";
import * as types from "./type";
import { Octokit } from "@octokit/core";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { z } from "zod";

export const getPullRequest = async (input: lib.Input): Promise<types.PullRequest> => {
  const octokit = github.getOctokit(input.githubToken);
  const result = await octokit.graphql<any>(
    `query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      headRefOid
      author {
        login
        resourcePath
      }
      reviews(first: 100) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          state
          commit {
            oid
          }
          author {
            login
            resourcePath
          }
        }
      }
      commits(first: 100) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          commit {
            oid
            committer {
              user {
                login
                resourcePath
              }
            }
            author {
              user {
                login
                resourcePath
              }
            }
          }
        }
      }
    }
  }
}`,
    {
      owner: input.repositoryOwner,
      repo: input.repositoryName,
      pr: input.pullRequestNumber,
    },
  );
  return types.PullRequest.parse(result);
};

const QueryCommits = z.object({
  repository: z.object({
    pullRequest: z.object({
      commits: types.Commits,
    }),
  }),
});

type QueryCommits = z.infer<typeof QueryCommits>;

export const listCommits = async (input: lib.Input, cursor: string): Promise<types.PullRequestCommit[]> => {
  const MyOctokit = Octokit.plugin(paginateGraphQL);
  const octokit = new MyOctokit({ auth: input.githubToken });
  const result = await octokit.graphql.paginate(
    `query paginate($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      commits(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          commit {
            committer {
              user {
                login
                resourcePath
              }
            }
            author {
              user {
                login
                resourcePath
              }
            }
          }
        }
      }
    }
  }
}`,
    {
      owner: input.repositoryOwner,
      repo: input.repositoryName,
      pr: input.pullRequestNumber,
      cursor: cursor,
    },
  );
  const pr = QueryCommits.parse(result);
  return pr.repository.pullRequest.commits.nodes;
};

const QueryReviews = z.object({
  repository: z.object({
    pullRequest: z.object({
      reviews: types.Reviews,
    }),
  }),
});

type QueryReviews = z.infer<typeof QueryReviews>;

export const listReviews = async (input: lib.Input, cursor: string): Promise<types.Review[]> => {
  const MyOctokit = Octokit.plugin(paginateGraphQL);
  const octokit = new MyOctokit({ auth: input.githubToken });
  const result = await octokit.graphql.paginate(
    `query paginate($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviews(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          state
          commit {
            oid
          }
          author {
            login
            resourcePath
          }
        }
      }
    }
  }
}`,
    {
      owner: input.repositoryOwner,
      repo: input.repositoryName,
      pr: input.pullRequestNumber,
      cursor: cursor,
    },
  );
  const pr = QueryReviews.parse(result);
  return pr.repository.pullRequest.reviews.nodes;
};
