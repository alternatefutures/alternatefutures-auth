# Claude Code Review Setup

This repository is configured to automatically review pull requests using Claude AI.

## How It Works

When a pull request is opened, updated, or reopened, the `claude-code-review.yml` workflow:

1. Fetches the PR diff
2. Sends it to Claude AI for analysis
3. Posts a comprehensive code review as a PR comment

## What Claude Reviews

Claude analyzes the code for:

- **Security Issues**: Vulnerabilities and security concerns
- **Bugs**: Potential bugs or logic errors
- **Code Quality**: Readability and maintainability suggestions
- **Best Practices**: Style and pattern violations
- **Performance**: Potential performance issues
- **Positive Notes**: What was done well

## Setup Instructions

### 1. Get an Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it starts with `sk-ant-`)

### 2. Add the API Key to GitHub Secrets

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `ANTHROPIC_API_KEY`
5. Value: Paste your Anthropic API key
6. Click **Add secret**

### 3. Enable GitHub Actions

1. Go to **Settings** → **Actions** → **General**
2. Ensure **Allow all actions and reusable workflows** is selected
3. Under **Workflow permissions**, ensure:
   - **Read and write permissions** is selected, OR
   - **Read repository contents and packages permissions** with **Allow GitHub Actions to create and approve pull requests** checked

### 4. Test the Setup

1. Create a new branch and make some changes
2. Open a pull request
3. Wait for the Claude Code Review workflow to complete
4. Check the PR comments for Claude's review

## Limitations

- **Diff Size**: PRs with diffs larger than 100KB will receive a warning to break the PR into smaller pieces
- **API Rate Limits**: Subject to Anthropic API rate limits
- **API Costs**: Each review consumes API credits (typically $0.01-0.10 per review depending on diff size)

## Disabling Reviews

To temporarily disable automatic reviews:

1. Go to **Actions** tab
2. Select **Claude Code Review** workflow
3. Click the **...** menu → **Disable workflow**

Or remove/rename the `.github/workflows/claude-code-review.yml` file.

## Cost Estimation

Based on typical pull request sizes:

- Small PR (< 500 lines): ~$0.01
- Medium PR (500-2000 lines): ~$0.03-0.05
- Large PR (2000-5000 lines): ~$0.10

Using Claude Sonnet 4, which provides excellent code review quality at reasonable cost.

## Troubleshooting

### Workflow Fails with "Bad credentials"

- Verify the `ANTHROPIC_API_KEY` secret is set correctly
- Check that the API key hasn't expired
- Ensure there are no extra spaces in the secret value

### No Review Comment Posted

- Check the Actions tab for error logs
- Verify the workflow has permission to write to pull requests
- Ensure the diff size isn't too large

### Review Quality Issues

- Claude performs best on focused, incremental changes
- Very large PRs may receive less detailed reviews
- Consider breaking large changes into smaller PRs

## Support

For issues with:
- **The workflow**: Check GitHub Actions logs
- **Claude API**: See [Anthropic Documentation](https://docs.anthropic.com/)
- **Code review quality**: Adjust the prompt in `claude-code-review.yml`
