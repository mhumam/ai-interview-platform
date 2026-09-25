import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

// Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F2:
// any failure loading candidate info used to collapse into the same
// "✅ Interview Complete" screen as a genuinely finished interview. A bad
// token must show "invalid link", and a transient failure must be retryable
// instead of terminal.

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
  },
}));

// HardwareCheck does its own internet-speed/camera/mic probing, out of scope
// for this test — replace with a stub so it doesn't interfere.
vi.mock("@/components/HardwareCheck", () => ({
  default: () => <div>hardware check stub</div>,
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: () => ({
    connect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: "connected",
  }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

function renderAtToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage — candidate info failures (F2)", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset();
  });

  it("shows an invalid-link screen for a 404, never the completion screen", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue({ response: { status: 404 } });

    renderAtToken("bad-token");

    expect(await screen.findByText(/this interview link is invalid/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
  });

  it("retries automatically on a transient failure, then offers a manual retry — never the completion screen", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue(new Error("network down"));

    renderAtToken("some-token");

    expect(await screen.findByText(/couldn't connect/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
    // 1 initial attempt + 2 automatic retries before giving up
    expect(sessionsApi.getCandidateInfo).toHaveBeenCalledTimes(3);
  });

  it("renders the real completion screen when the session genuinely already ended", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: { session_id: 1, role_title: "Senior Engineer", time_limit_min: 45, session_status: "ended" },
    } as any);

    renderAtToken("finished-token");

    expect(await screen.findByText(/interview complete/i)).toBeInTheDocument();
  });
});
