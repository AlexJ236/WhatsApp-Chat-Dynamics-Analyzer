# ¿Me conviene? - WhatsApp Chat Dynamics Analyzer

**Live Application:** https://meconviene.netlify.app/

"¿Me conviene?" is a web-based tool designed to analyze exported WhatsApp chat `.txt` or `.zip` files. It provides users with metrics, visualizations, and qualitative insights into their communication dynamics, helping them reflect on their interactions. A key feature is its commitment to privacy: all processing is done 100% locally in the user's browser, meaning no chat data is ever uploaded to any server.

The application interface is primarily in **Spanish**.

## Key Features

* **Flexible File Upload:** Supports both raw `.txt` chat exports and `.zip` archives containing a chat `.txt` file.
* **Privacy First - 100% Local Analysis:** All file reading, parsing, and analysis (including AI-driven sentiment analysis) happens directly in the user's browser. No data ever leaves the user's computer.
* **Detailed Metrics & Statistics:**
    * Total message counts (overall and per participant).
    * Conversation date range.
    * Average words per message for each participant.
    * Median response times.
    * Conversation initiators.
    * Detection of "unilateral segments" (sequences of messages from one participant with significant response delays).
    * Media message counts.
    * Emoji usage counts per participant.
* **Interactive Visualizations (Chart.js):**
    * **Message Distribution:** A stacked bar chart showing the percentage of messages contributed by each participant.
    * **Chat Activity Timeline:** A line chart displaying message frequency per day.
    * **Estimated Affection Index:** Bar display визуализирующий an estimated affection level per participant.
* **Qualitative & AI-Driven Insights (Client-Side):**
    * **Sentiment Analysis:** Utilizes Transformers.js (Xenova/pysentimiento-robertuito-sentiment-analysis model) to perform client-side sentiment analysis (Positive/Negative/Neutral) on eligible messages.
    * **Affection Index:** An estimated score based on keywords, emojis, and AI-derived positive sentiment.
    * **Communication Patterns:** Identifies and lists "Observed Positive Patterns" and "Patterns for Reflection" based on metrics, keywords, and sentiment. These are phrased to encourage self-reflection rather than being purely mathematical outputs.
    * **Overall Interpretation:** A textual summary synthesizing the various analytical points.
* **Export Report:** Users can download a PNG image of the generated analysis report using `html2canvas`.

## Tech Stack

* **Frontend:** React, TypeScript
* **Build Tool:** Vite
* **Styling:** Global CSS (based on an elegant and romantic theme)
* **Charting:** Chart.js with `react-chartjs-2`
* **Image Export:** `html2canvas`
* **ZIP File Processing:** `jszip`
* **Client-Side AI/NLP:** Transformers.js (`@xenova/transformers`)
    * **Sentiment Model:** `Xenova/pysentimiento-robertuito-sentiment-analysis`
* **Linting/Formatting:** ESLint, Prettier
* **Hosting & CI/CD:** Netlify (via GitHub integration)

## Project Structure

The project is organized with the Vite application root directly in the main repository directory (`WhatsApp-Chat-Dynamics-Analyzer/`).
```
WhatsApp-Chat-Dynamics-Analyzer/
├── public/               # Static assets (favicon, _redirects for Netlify)
├── src/                  # Main application source code
│   ├── assets/           # Images, fonts, etc. (if any)
│   ├── components/       # React components (UI, Layout, Report elements)
│   │   ├── FileUpload/
│   │   ├── Layout/
│   │   └── Report/       # Components for displaying analysis results
│   │       ├── Affection/
│   │       ├── Charts/
│   │       ├── Interpretation/
│   │       ├── Patterns/
│   │       └── SummaryCards/
│   ├── services/         # Business logic, analysis functions, parsing
│   │   ├── chatParser.ts
│   │   ├── fileReaderService.ts
│   │   ├── interpretationGenerator.ts
│   │   ├── metricsCalculator.ts
│   │   └── sentimentAnalyzer.ts
│   ├── styles/           # Global stylesheets
│   │   └── global.css
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx           # Main application component, orchestrates views and logic
│   ├── main.tsx          # React entry point
│   └── vite-env.d.ts     # Vite TypeScript environment types
├── .eslintrc.cjs         # ESLint configuration
├── .gitignore
├── index.html            # Main HTML entry point for Vite
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # Main TypeScript configuration
├── tsconfig.app.json     # App-specific TypeScript configuration (JSX, etc.)
├── tsconfig.node.json    # Node-specific TypeScript configuration (for Vite config)
├── vite.config.ts        # Vite configuration
└── README.md             # This file
```

## Getting Started (Local Development)

To run this project locally, follow these steps:

**Prerequisites:**
* Node.js (v18.x or later recommended)
* npm (usually comes with Node.js) or Yarn

**Setup:**

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/AlexJ236/WhatsApp-Chat-Dynamics-Analyzer](https://github.com/AlexJ236/WhatsApp-Chat-Dynamics-Analyzer)
    cd whats
    ```

2.  **Install dependencies:**
    (Ensure you are in the `WhatsApp-Chat-Dynamics-Analyzer/` directory, which is now the project root)
    ```bash
    npm install
    ```
    or if you prefer Yarn:
    ```bash
    yarn install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start the Vite development server, typically at `http://localhost:5173`. Open this URL in your browser.

4.  **Build for production:**
    To create an optimized production build:
    ```bash
    npm run build
    ```
    The output will be in the `dist/` folder.

## Deployment

This application is continuously deployed on Netlify. Any push to the `main` branch (or your configured production branch) will trigger a new build and deployment.

Key Netlify settings for this project structure:
* **Base directory:** (empty - repository root)
* **Build command:** `npm run build`
* **Publish directory:** `dist`
* A `public/_redirects` file with `/* /index.html 200` is used to ensure proper SPA routing on Netlify.

## Privacy
User privacy is paramount. All chat file processing and analysis occurs entirely within the user's browser. No chat data is ever transmitted to or stored on any external server, ensuring users have full control over their personal information.

## Future Enhancements (Possible Ideas)

* More advanced and nuanced communication pattern detection.
* User-configurable thresholds for certain metrics.
* Detailed drill-downs for specific patterns or metrics.
* UI/UX refinements for even better readability and interaction.
* Localization options for the UI (beyond the current Spanish).

## License

MIT License

Copyright (c) 2025 [AlexJ236]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
