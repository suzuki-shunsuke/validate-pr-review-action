import * as core from "@actions/core";
import * as github from "@actions/github";

export type Input = {
  githubToken: string;
  repositoryOwner: string;
  repositoryName: string;
  pullRequestNumber: number;
  trustedApps: Set<string>;
  trustedMachineUsers: Set<string>;
  untrustedMachineUsers: Set<string>;
  untrustedMachineUserRegexps: RegExp[];
  // postComment: boolean;
};

export type RawInput = {
  githubToken: string;
  repositoryOwner: string;
  repositoryName: string;
  pullRequestNumber: string;
  trustedApps: string[];
  trustedMachineUsers: string[];
  untrustedMachineUsers: string[];
};
