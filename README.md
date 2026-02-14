# Bila UiTM Cuti?

Academic calendar web app for Universiti Teknologi MARA (UiTM) — Malaysia's largest public university. Built to help students quickly check semester dates, breaks, exams, and registration deadlines.

**Live:** [cutiuitm.xyz](https://cutiuitm.xyz)

## Features

### Academic Calendar
- Grid and list views for the 2026 academic calendar
- Program-specific schedules: Foundation, Pre-Diploma, Diploma, Bachelor's, Master's, PhD
- Group A (Dec 2025 – May 2026) and Group B (Mar – Aug 2026)
- Regional date variations for Kedah, Kelantan, and Terengganu (Friday–Saturday weekend states)
- Filter by event type: registration, lectures, exams, breaks
- Countdown to next activity

### AI Chat Assistant
- Ask about academic dates, breaks, and exams in English or Malay
- General UiTM info: campuses, faculties, programs, admission
- Context-aware answers based on selected program
- Powered by Groq (Llama 3.1 8B primary, GPT-OSS 20B fallback)
- Rate limited: 10/min, 30/day per IP, 500/day global

### Progressive Web App
- Installable on mobile and desktop
- Offline-capable via service worker
- Dark and light theme with system detection

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui, Radix UI
- **AI:** Groq SDK (llama-3.1-8b-instant, openai/gpt-oss-20b)
- **Calendar:** react-day-picker, date-fns
- **Validation:** Zod
- **Analytics:** Vercel Analytics
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- Groq API key ([console.groq.com](https://console.groq.com))

### Installation

```bash
git clone https://github.com/your-username/cuti-ui-tm.git
cd cuti-ui-tm
npm install
```

### Environment Variables

Copy the example file and add your API key:

```bash
cp .env.example .env.local
```

```env
GROQ_API_KEY=your_groq_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
app/
  page.tsx              # Homepage (grid view)
  layout.tsx            # Root layout, metadata, theme
  [program]/            # Dynamic program-specific routes
  chat/
    page.tsx            # AI chat interface
    api/route.ts        # Chat API (rate limiting, validation, AI)
  list/                 # List view page
components/
  ui/                   # shadcn/ui components
  calendar-wrapper.tsx  # Calendar display logic
  calendar-header.tsx   # Header with program selector
  grid-view.tsx         # Grid calendar view
  list-view.tsx         # List calendar view
  theme-toggle.tsx      # Dark/light theme switch
lib/
  ai.ts                # Groq AI integration with fallback
  data.ts              # Academic calendar data (activities, dates)
  uitm-info.ts         # UiTM general knowledge base
  system-rules.json    # AI system prompts
  cookie-utils.ts      # Filter persistence
public/
  manifest.json        # PWA manifest
  sw.js                # Service worker
```

## Rate Limits

The AI chat feature has three layers of protection:

| Layer | Limit | Reset |
|---|---|---|
| Per IP / minute | 10 requests | Rolling 60-second window |
| Per IP / day | 30 requests | Rolling 24-hour window |
| Global / day | 500 requests | Rolling 24-hour window |

## License

All rights reserved.
