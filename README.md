The ideas of this project comes from: https://roadmap.sh/projects/todo-list-api

# To-do list API

## Overview

A simple API that allows registration/login of a user. Then allow adding/removing a tasks, edit their description, and marking them as completed.

## Installation

Make sure you have NodeJS installed (>= v26.7.0), and npm (>= 12.0.2).

1. Clone the repo

2. Install these packages while inside of the repo

- @types/better-sqlite3@9.6.0
- @types/node@26.4.1
- better-sqlite3@13.0.3
- tsx@4.23.13
- typescript@7.0.2

## Test it out

Within the repo, run:

```
npm run dev
```

to start the server.

## What it has

- User registration/login
- User validation using session ids
- Add/Remove/Edit description/Mark as complete for tasks.
