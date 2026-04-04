# Contributing

Thanks for contributing to SmartShift.

## Setup

1. Fork and clone the repository.
2. Copy `.env.example` to `.env` and configure secrets.
3. Install dependencies:
   - `npm install`
4. Run the app:
   - `npm run dev:full`

## Development Rules

- Keep pull requests focused and small.
- Do not commit `.env`, build outputs, or generated dependency folders.
- Run checks before opening a pull request:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Commit Messages

Use clear, action-oriented commit messages, for example:

- `fix: persist active plan across relogin`
- `feat: add admin claim approval queue`

## Pull Requests

Include the following in every PR:

- What changed
- Why it changed
- How to test
- Screenshots for UI changes (if applicable)
