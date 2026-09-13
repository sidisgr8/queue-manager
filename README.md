# QueueSys

A full-stack virtual waiting-line platform that lets businesses manage queues while customers join remotely and track their place in line without standing physically at the venue.

## Overview

QueueSys is built around two user experiences:

- **Queue managers** can create and operate queues, monitor customers, and control the flow of service.
- **Remote customers** can discover a queue, join it remotely, and track their position and status.

The goal is simple: move the waiting experience online so customers spend less time standing in physical lines while businesses get a clearer view of the queue.

## Key Features

- Role-based interfaces for queue managers and customers
- Remote queue joining and live queue-status tracking
- Optimistic UI updates for a responsive experience
- AbortController-based polling to prevent overlapping or stale requests
- Location-aware queue discovery
- Address geocoding through the OpenStreetMap Nominatim API
- Distance calculation using the Haversine formula for proximity-based sorting
- Responsive React interface with Bootstrap styling
- Lucide icons for a clean, consistent interface

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite |
| Styling | Bootstrap 5 |
| Icons | Lucide React |
| Location / Geocoding | OpenStreetMap Nominatim API |
| Language | JavaScript (ES Modules) |
| Tooling | Vite, ESLint |

## Architecture

```text
Customer / Queue Manager
          │
          ▼
      React UI
          │
          ├── Queue state polling
          ├── Optimistic updates
          └── Location-aware discovery
          │
          ▼
     Queue / API layer
          │
          └── AbortController
          │
          ▼
 OpenStreetMap Nominatim
        (geocoding)
          │
          ▼
   Haversine distance
   (proximity sorting)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/sidisgr8/queue-manager.git
cd queue-manager
npm install
```

### Development

```bash
npm run dev
```

Vite will start the development server and print the local development URL in the terminal.

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Why QueueSys?

Traditional waiting lines make customers spend time inside a physical queue even when their service has not started. QueueSys moves that waiting experience online: customers can join remotely, monitor progress, and decide when it is worth arriving, while queue managers get a clearer operational view of the people waiting.

## Project Highlights

The project demonstrates practical frontend engineering around state synchronization, responsive UI design, location-aware discovery, and asynchronous request handling. A key implementation detail is the use of **AbortController-based polling**, allowing stale requests to be cancelled instead of competing with newer queue-state requests.

## Repository

[GitHub — QueueSys](https://github.com/sidisgr8/queue-manager)

## Author

**Siddharth Nair**  
GitHub: [@sidisgr8](https://github.com/sidisgr8)
