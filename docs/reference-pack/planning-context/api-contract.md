# API Contract (Draft)

Base path: `/api`

Authentication: cookie session + CSRF token for mutating requests.

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Stories

- `GET /stories`
- `POST /stories`
- `GET /stories/{storyId}`
- `PATCH /stories/{storyId}`
- `DELETE /stories/{storyId}`

## Chapters

- `GET /stories/{storyId}/chapters`
- `POST /stories/{storyId}/chapters`
- `GET /chapters/{chapterId}`
- `PATCH /chapters/{chapterId}`
- `DELETE /chapters/{chapterId}`
- `PUT /chapters/{chapterId}/transcript`
- `POST /chapters/{chapterId}/clips` (multipart)
- `POST /chapters/{chapterId}/validate`

## Session Lifecycle

- `POST /chapters/{chapterId}/sessions` (start)
- `GET /sessions/{sessionId}/state`
- `POST /sessions/{sessionId}/attempts`
- `POST /sessions/{sessionId}/events`
- `POST /sessions/{sessionId}/diff`
- `POST /sessions/{sessionId}/tutor-feedback`
- `POST /sessions/{sessionId}/complete`
- `POST /sessions/{sessionId}/exit`

## History

- `GET /sessions` (filters: story/chapter/date/status)
- `GET /sessions/{sessionId}`

## Schedule

- `GET /schedule`
- `PUT /chapters/{chapterId}/schedule` (upsert)
- Optional: `PATCH /schedule/{scheduleId}` and `DELETE /schedule/{scheduleId}`

## Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "clip_count must match line_count",
    "details": {
      "lineCount": 249,
      "clipCount": 196
    }
  }
}
```
