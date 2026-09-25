import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";

// Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F4:
// a session that never started (no portfolio, never interviewed) must not
// render the same "AI is analyzing... ~2 minutes" message as a session
// whose portfolio worker is genuinely in flight.

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage — not_started vs generating (F4)", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockReset();
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Test" } },
    } as any);
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [] } } as any);
  });

  it("shows a not-started message, not the fake analyzing spinner, when the interview never started", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "not_started" } } as any);

    renderPage();

    expect(await screen.findByText(/interview hasn't started yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/generating portfolio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this takes about 2 minutes/i)).not.toBeInTheDocument();
  });

  it("still shows the analyzing message when a worker is genuinely generating", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();

    expect(await screen.findByText(/generating portfolio/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview hasn't started yet/i)).not.toBeInTheDocument();
  });
});
