# Box Document Control

## Introduction
This project supports document control for organizations certified against standards such as ISO 27001/27002 and ETSI. These standards require documents to be reviewed and updated at a regular interval.

The Node.js script runs as a monthly scheduled job. It searches Box for documents whose approval is about to expire and creates a Box task on each of them, assigned to the people responsible for keeping the document up to date.

## How it works

1. **Scheduling** – The container starts `entrypoint.sh`, which installs a single crontab entry based on the `runningCron` expression and runs `document-control.js` on that schedule. The container timezone is `Europe/Amsterdam`.
2. **Authentication** – The script authenticates to Box as a JWT (server authentication) app. An access token is minted automatically as soon as Box responds with `401 Unauthorized`.
3. **Role definition** – A JSON file stored in Box (see [Role definition](#role-definition)) maps each role name to a Box user login. One role can be marked as *accountable*.
4. **Search window** – The script calculates the calendar month that lies `notifyNumberOfMonthsAhead` months ahead and `yearsDocumentsValidity` years back. With the default settings (1 and 1), a run in September 2026 looks for documents approved in October 2025, so they expire next month.
5. **Search** – Box is searched for files carrying the `documentControl` metadata template with an `approvalDate` within that month (first and last day inclusive).
6. **Task creation** – For every document found:
   - The expiration date is `approvalDate + yearsDocumentsValidity` years.
   - The task due date is the expiration date minus `weeksRequiredForApproval` weeks. If that leaves less than `minimumWeeksRequiredForUpdating` weeks from now, the due date becomes now plus `minimumWeeksRequiredForUpdating` weeks.
   - A Box task is created on the document and assigned to:
     - the **responsible**: the user holding the role in the document's `ownership` field, and
     - the **accountable**: the user holding the role marked `accountable`, if this is a different person.

Warnings are logged when the `ownership` role is not found in the role definition or when no role is marked as accountable. In both cases the task is still created, but without that assignee.

## Box configuration

- **Custom app** using JWT server authentication. The app needs read access to the content and write access to create tasks. The app's service account must have access to the documents under control and to the role definition file.
- **Metadata template** with the technical name `documentControl`, containing at least:
  - `approvalDate` (date): the date the current version of the document was approved
  - `ownership` (text): the name of the role responsible for the document, exactly matching a key in the role definition

## Role definition

The role definition is a JSON file stored in Box. Its file ID is configured with `roleDefinitionBoxId`. Each key is a role name, and each role requires a `login` (the Box login of the user holding that role). Exactly one role should be marked with `"accountable": true`.

```json
{
    "COO": {
        "login": "coo@example.com",
        "accountable": true
    },
    "Security Officer": {
        "login": "security.officer@example.com"
    },
    "HR Manager": {
        "login": "hr.manager@example.com"
    }
}
```

If the file is not valid (a role without `login`), an error is logged and tasks are created without assignees.

## Configuration

All settings are passed as environment variables.

| Variable | Description |
|---|---|
| `runningCron` | Cron expression for the job, e.g. `0 0 15 * *` (15th of every month at midnight). Only used by the container. |
| `yearsDocumentsValidity` | Number of years a document approval stays valid. |
| `notifyNumberOfMonthsAhead` | How many months before expiration the task is created. |
| `weeksRequiredForApproval` | Weeks reserved before the expiration date to review and approve the updated document. |
| `minimumWeeksRequiredForUpdating` | Minimum number of weeks between task creation and its due date. |
| `debug` | `true` or `false`. Enables verbose logging. Required. |
| `roleDefinitionBoxId` | Box file ID of the role definition JSON. |
| `boxDefaultBaseUrl` | Box API base URL, `https://api.box.com/2.0/`. |
| `boxTokenUrl` | Box token URL, `https://api.box.com/oauth2/token`. |
| `jwtClientID` | Client ID of the Box app. |
| `jwtClientSecret` | Client secret of the Box app. |
| `jwtPublicKeyID` | ID of the public key registered with the Box app. |
| `jwtPrivateKeyBase64` | The encrypted private key (PEM) of the key pair, Base64-encoded. |
| `jwtPassphrase` | Passphrase of the private key. |
| `jwtEnterpriseID` | Box enterprise ID. |
| `setTasksOnDayOfMonth` | Currently not used. The schedule is determined by `runningCron`. |

## Running

### Locally

```sh
npm ci
export $(grep -v '^#' ./dev-variables.txt | xargs)
node document-control.js
```

`dev-variables.txt` contains secrets and is excluded from both git and the Docker image.

### Docker

```sh
docker build -t box-document-control .
docker run -d --env-file dev-variables.txt -e runningCron='0 0 15 * *' box-document-control
```

The container keeps running and executes the job according to `runningCron`.

## Limitations

- **Maximum of 200 documents per run.** Only the first page of search results (200 documents) is processed. A warning is logged if Box reports more matches.
- **Not idempotent.** Running the job more than once for the same month creates duplicate tasks on the same documents.
- **Exact role names.** The `ownership` value must match a role name in the role definition exactly, including capitalization.
