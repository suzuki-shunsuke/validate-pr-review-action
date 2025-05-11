# validate-pr-review-action

[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/validate-pr-review-action/main/LICENSE) | [action.yaml](action.yaml) | [Troubleshooting](docs/trouble-shooting.md)

`validate-pr-review-action` is a GitHub Action to validate pull request reviews.
It makes GitHub Actions secure.
It enforces the requirement for reviews and prevents pull requests from being merged without proper review.
While making reviews mandatory in branch rulesets helps, there are still loopholes that allow pull requests to be merged without a review.
This action helps close those loopholes.

When developing as a team, it's common to require that pull requests be reviewed by someone other than the author.
Code reviews help improve code quality, facilitate knowledge sharing among team members, and prevent any single person from making unauthorized changes without approval.

First, you should enable the following branch ruleset on the default branch.

- `Require a pull request before merging`
  - `Require review from Code Owners`
  - `Require approval of the most recent reviewable push`
- `Require status checks to pass`

This rules require pull request reviews, but there are still several ways to improperly merge a pull request without a valid review:

1. Abusing a machine user with `CODEOWNER` privileges to approve the PR.
2. Adding commits to someone else’s PR and approving it yourself.
3. Using a machine user or bot to add commits to someone else’s PR, then approving it yourself.

You can address these loopholes by running this action via `pull_request_review` or `merge_group` events and adding the job to Branch Ruleset's Required Checks.

This action performs the following validations:

- The latest commit in the PR must be approved by someone who didn't contribute commits to the PR
- Approvals from GitHub Apps or untrusted machine users are ignored

In the following cases, two or more approvals are required:

- If any of the commits were made by an **untrusted** machine user or a GitHub App (excluding a few **trusted** ones)
- If the pull request was created by an untrusted machine user or GitHub App (excluding a few trusted ones)
- If there are commits without a linked GitHub user

## Usage

```yaml
name: Validate pull request reviews
on:
  pull_request_review:
    types:
      - submitted
      - dismissed
jobs:
  validate-pr-review:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions:
      pull-requests: read # To get pull requests
      contents: read # To get pull request commits
    steps:
      - uses: suzuki-shunsuke/validate-pr-review-action@bd967a12742566a5e3fb02878e4e2447da68f72e # v0.0.4
```

## Action's Inputs / Outputs

Please see [action.yaml](action.yaml)

## Enforce Commit Signing by Branch Rulesets

We strongly recommend enforcing commit signing by Branch Rulesets.
Otherwise, malicious people can impersonate to other users and create commits.
This action doesn't verify commit signing because you can do it using Branch Rulesets.

## Trusted Apps and untrusted users

You can specify lists of trusted GitHub Apps, trusted machine users, and untrusted machine users.

```yaml
uses: suzuki-shunsuke/validate-pr-review-action@bd967a12742566a5e3fb02878e4e2447da68f72e # v0.0.4
with:
  # trusted_apps and trusted_machine_users don't support regular expressions.
  # You must specify trusted apps and machine users explicitly.
  trusted_apps: |
    # A line starting with "#" is ignored as comment
    renovate
    dependabot
  # untrusted_machine_users supports regular expressions too.
  # Enclose a regular expression between slashes like `/-bot$/`.
  untrusted_machine_users: |
    # A line starting with "#" is ignored as comment
    mini-core
    /-bot$/
  # trusted_machine_users is a list of trusted apps.
  # If a user matches with both `trusted_machine_users` and `untrusted_machine_users`, it is considered trusted.
  # trusted_machine_users is useful to exclude specific machine users from regular expressions of untrusted_machine_users.
  trusted_machine_users: |
    # A line starting with "#" is ignored as comment
    suzuki-shunsuke-bot
```

You should use `trusted_apps` carefully.
You shouldn't specify GitHub Apps not managing securely.
You should set all Machine Users to `untrusted_machine_users` except for Machine Users managing securely.

Whether a GitHub App is considered trusted or a user is considered an untrusted machine user depends on how securely they are managed and whether they are susceptible to misuse.

For example, if a GitHub App is installed across all repositories in an organization and granted `contents:write` and `pull_requests:write` permissions, and if its App ID and private key are shared across all repositories via GitHub Organization Variables and Secrets, that App cannot be trusted.
Any organization member can exploit the App to create pull requests, make commits, or approve changes from any branch in any repository.

By default, only `renovate` and `dependabot` are treated as trusted GitHub Apps.
All others are considered untrusted unless explicitly specified.

### Steps to secure GitHub Apps and Machine Users

In many organizations, machine users and GitHub Apps are often not properly managed securely.
To address this, consider following these steps:

1. Create new machine users and GitHub Apps.
1. Apply strict access controls to these newly created accounts.
1. Gradually replace existing machine users and GitHub Apps with the newly secured ones.
1. Minimize permissions for any existing accounts that remain in use.
1. Decommission unused or insecure accounts.

### Client/Server Model Actions

Client/Server Model Actions allow you to manage GitHub Apps and Machine Users securely.
For more details, see:

👉 https://github.com/csm-actions/docs

## Available versions

> [!CAUTION]
> We don't add `dist/*.js` in the main branch and feature branches.
> So you can't specify `main` and feature branches as versions.
>
> ```yaml
> # This never works as dist/index.js doesn't exist.
> uses: suzuki-shunsuke/validate-pr-review-action@main
> ```

The following versions are available.

1. [Release versions](https://github.com/suzuki-shunsuke/validate-pr-review-action/releases)

```yaml
uses: suzuki-shunsuke/validate-pr-review-action@bd967a12742566a5e3fb02878e4e2447da68f72e # v0.0.4
```

2. [Pull Request versions](https://github.com/suzuki-shunsuke/validate-pr-review-action/branches/all?query=pr%2F&lastTab=overview): These versions are removed when we feel unnecessary. These versions are used to test pull requests.

```yaml
uses: suzuki-shunsuke/validate-pr-review-action@pr/2
```

3. [latest branch](https://github.com/suzuki-shunsuke/validate-pr-review-action/tree/latest): [This branch is built by CI when the main branch is updated](https://github.com/suzuki-shunsuke/validate-pr-review-action/blob/latest/.github/workflows/main.yaml). Note that we push commits to the latest branch forcibly.

```yaml
uses: suzuki-shunsuke/validate-pr-review-action@latest
```

Pull Request versions and the latest branch are unstable.
These versions are for testing.
You should use the latest release version in production.
