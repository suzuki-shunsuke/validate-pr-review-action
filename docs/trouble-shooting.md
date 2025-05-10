# Troubleshooting

## Why did this action fail even though the pull request was approved?

You may wonder why this action failed even though your pull request was approved.
There are some possible reasons:

- The latest commit of the pull request isn't approved 
- Approvals from GitHub Apps are ignored
- Approvals from untrusted machine users are ignored
- Approvals from pull request committers are ignored

Two approvals are required in following cases:

- If any of the commits were made by an **untrusted** machine user or a GitHub App (excluding a few **trusted** ones)
- If the pull request was created by an untrusted machine user or GitHub App (excluding a few trusted ones)
- If there are commits without a linked GitHub user
