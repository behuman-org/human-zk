import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "./i18n/I18nProvider";
import { FeedPage } from "./pages/FeedPage";
import { SocialShell } from "./pages/SocialShell";

vi.mock("./feed/platformApi", () => ({
  checkHealth: vi.fn().mockResolvedValue(true),
  getFeed: vi.fn().mockResolvedValue([]),
  getProfile: vi.fn().mockResolvedValue({ username: "test_user", handle: "ab12f" }),
  getCommunities: vi.fn().mockResolvedValue([]),
  getNotifications: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn().mockResolvedValue([]),
  computeContentHash: vi.fn().mockResolvedValue("abc123"),
  PlatformApiError: class PlatformApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

function renderAppAt(path = "/app") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <Routes>
          <Route path="/app" element={<SocialShell />}>
            <Route index element={<FeedPage />} />
          </Route>
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe("FeedPage", () => {
  beforeEach(() => {
    localStorage.setItem(
      "behuman_platform_session",
      JSON.stringify({
        username: "test_user",
        bio: "",
        avatarIndex: 0,
      }),
    );
  });

  it("muestra el feed con identidad propia", async () => {
    renderAppAt();
    expect(screen.getByRole("heading", { name: /^feed$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/test_user/i).length).toBeGreaterThan(0);
    });
  });

  it("incluye composer con lenguaje beHuman", async () => {
    renderAppAt();
    await waitFor(() => {
      expect(screen.getAllByText(/test_user/i).length).toBeGreaterThan(0);
    });
    const composer = screen.getByRole("region", { name: /publicar opinión/i });
    expect(composer).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /escribí tu opinión/i }),
    ).toBeInTheDocument();
    expect(composer.querySelector(".voice-composer__submit")).toBeTruthy();
  });
});
