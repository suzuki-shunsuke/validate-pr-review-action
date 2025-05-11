import * as core from "@actions/core";
import * as github from "@actions/github";

export type Input = {
  githubToken: string;
  repositoryOwner: string;
  repositoryName: string;
  pullRequestNumber: number;
  trustedApps: Set<string>;
  untrustedMachineUsers: Set<string>;
  untrustedMachineUserRegexps: RegExp[];
  // postComment: boolean;
};
