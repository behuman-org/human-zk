import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "./i18n/I18nProvider";
import { LandingPage } from "./pages/LandingPage";

function renderLanding() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <LandingPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("muestra la marca human en la navegación", () => {
    renderLanding();
    expect(document.querySelector(".site-nav__logo")).toBeInTheDocument();
  });

  it("describe la idea en dos pasos", () => {
    renderLanding();
    const capas = document.getElementById("capas");
    expect(capas).toBeInTheDocument();
    expect(capas?.querySelector(".section-title")).toHaveTextContent(/Two steps, one identity/i);
    expect(document.getElementById("capa-1")).toBeInTheDocument();
    expect(document.getElementById("capa-2")).toBeInTheDocument();
  });

  it("documenta el recorrido en cuatro pasos", () => {
    renderLanding();
    const section = document.getElementById("como-funciona");
    expect(section?.querySelectorAll(".step-card")).toHaveLength(4);
    expect(section?.textContent).toMatch(/Validate your identity/i);
    expect(section?.textContent).toMatch(/Participate on the platform/i);
  });

  it("incluye plataforma y curaduría", () => {
    renderLanding();
    const plataforma = document.getElementById("plataforma");
    const curacion = document.getElementById("curacion");
    expect(plataforma?.querySelector(".section-title")).toHaveTextContent(
      /A place to speak freely/i,
    );
    expect(curacion?.querySelector(".section-title")).toHaveTextContent(/Respect without censorship/i);
  });

  it("expone menú móvil accesible para navegación", () => {
    renderLanding();
    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
    expect(document.getElementById("site-nav-mobile")).toBeInTheDocument();
  });
});
