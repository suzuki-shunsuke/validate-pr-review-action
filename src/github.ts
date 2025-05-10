import * as github from "@actions/github";
import * as lib from "./lib";
import { Octokit } from "@octokit/core";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";

export const getPullRequest = async (input: lib.Input): Promise<any> => {
  const octokit = github.getOctokit(input.githubToken);
  return await octokit.graphql<any>(
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
};

export const listCommits = async (input: lib.Input): Promise<any> => {
  const MyOctokit = Octokit.plugin(paginateGraphQL);
  const octokit = new MyOctokit({ auth: input.githubToken });
  return await octokit.graphql.paginate(
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
    },
  );
};

export const listReviews = async (input: lib.Input): Promise<any> => {
  const MyOctokit = Octokit.plugin(paginateGraphQL);
  const octokit = new MyOctokit({ auth: input.githubToken });
  return await octokit.graphql.paginate(
    `query paginate($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviews(first: 100, after: $cursor) {
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
    }
  }
}`,
    {
      owner: input.repositoryOwner,
      repo: input.repositoryName,
      pr: input.pullRequestNumber,
    },
  );
};
