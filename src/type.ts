import { z } from "zod";

const User = z.object({
  login: z.string(),
  resourcePath: z.string(),
});
export type User = z.infer<typeof User>;

const Review = z.object({
  state: z.string(),
  commit: z.object({
    oid: z.string(),
  }),
  author: User,
});
export type Review = z.infer<typeof Review>;

const Commit = z.object({
  oid: z.string(),
  committer: z.object({
    user: z.nullable(User),
  }),
  author: z.object({
    user: z.nullable(User),
  }),
});
export type Commit = z.infer<typeof Commit>;

const PullRequestCommit = z.object({
  commit: Commit,
});
export type PullRequestCommit = z.infer<typeof PullRequestCommit>;

export const PageInfo = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string(),
});

export const Reviews = z.object({
  pageInfo: PageInfo,
  nodes: z.array(Review),
});

export const Commits = z.object({
  pageInfo: PageInfo,
  nodes: z.array(PullRequestCommit),
});

export const PullRequest = z.object({
  repository: z.object({
    pullRequest: z.object({
      headRefOid: z.string(),
      author: User,
      reviews: Reviews,
      commits: Commits,
    }),
  }),
});

export type PullRequest = z.infer<typeof PullRequest>;
