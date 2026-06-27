export type Locale = "en" | "es";

export type NavLink = { label: string; href: string };

export type LayerItem = {
  id: string;
  tag: string;
  title: string;
  body: string;
  bullets: string[];
};

export type FlowStep = {
  num: string;
  title: string;
  body: string;
};

export type FeatureItem = {
  title: string;
  body: string;
};

export type CurationLevel = {
  title: string;
  body: string;
};

export type StellarItem = {
  name: string;
  hint: string;
};

export type RegisterStep = {
  title: string;
  body: string;
};

export interface SiteMessages {
  siteMeta: {
    name: string;
    projectName: string;
    org: string;
    tagline: string;
    description: string;
    htmlTitle: string;
  };
  hero: {
    badge: string;
    title: string;
    accent: string;
    lead: string;
    stackLabel: string;
    stackItems: string[];
    ctaVerify: string;
    ctaHowItWorks: string;
  };
  layers: {
    label: string;
    title: string;
    lead: string;
    bridge: string;
    items: LayerItem[];
  };
  kycFlow: {
    label: string;
    title: string;
    lead: string;
    steps: FlowStep[];
  };
  platform: {
    label: string;
    title: string;
    lead: string;
    postKindsAria: string;
    features: FeatureItem[];
    postKinds: string[];
  };
  curation: {
    label: string;
    title: string;
    lead: string;
    levelPrefix: string;
    levels: CurationLevel[];
    principle: string;
  };
  sectionDividers: string[];
  stellarStack: {
    label: string;
    lead: string;
    items: StellarItem[];
  };
  footer: {
    message: string;
    nav: NavLink[];
    external: NavLink[];
    legalPrefix: string;
    legalSuffix: string;
  };
  navLinks: NavLink[];
  auth: {
    backToHome: string;
    eyebrow: string;
    loginTitle: string;
    registerTitle: string;
    loginSubtitle: string;
    registerSubtitle: string;
    tabLogin: string;
    tabRegister: string;
    tabListLabel: string;
    loginPanelTitle: string;
    loginPanelBody: string;
    connectWallet: string;
    comingSoon: string;
    noPassword: string;
    registerSteps: RegisterStep[];
    startVerification: string;
    legal: string;
    brandPanelLabel: string;
    brandTitle: string;
    brandTitleAccent: string;
  };
  ui: {
    signIn: string;
    register: string;
    openMenu: string;
    closeMenu: string;
    language: string;
    switchToEn: string;
    switchToEs: string;
  };
  social: {
    nav: {
      feed: string;
      threads: string;
      messages: string;
      notifications: string;
      settings: string;
      publish: string;
      profile: string;
      unread: string;
    };
    messages: {
      title: string;
      inbox: string;
      chat: string;
      unread: string;
      empty: string;
      pick: string;
      exploreHint: string;
      back: string;
      placeholder: string;
      send: string;
      loading: string;
      threadEmpty: string;
      ariaChat: string;
    };
    feed: {
      title: string;
      sortNew: string;
      sortHot: string;
      loading: string;
      empty: string;
      threadEyebrow: string;
      members: string;
    };
    explore: {
      title: string;
      subtitle: string;
      create: string;
    };
    notifications: {
      title: string;
      markAll: string;
      empty: string;
      unread: string;
    };
    compose: {
      title: string;
      subtitle: string;
    };
    settings: {
      title: string;
      subtitle: string;
      appearance: string;
      theme: string;
      themeLight: string;
      themeDark: string;
      themeSystem: string;
      compactFeed: string;
      compactFeedDesc: string;
      reducedMotion: string;
      reducedMotionDesc: string;
      showSidebar: string;
      showSidebarDesc: string;
      language: string;
      languageDesc: string;
      privacy: string;
      privacyProfile: string;
      privacyProfileDesc: string;
      privacyMessages: string;
      privacyMessagesDesc: string;
      account: string;
      editProfileHint: string;
      goToProfile: string;
      reset: string;
      resetDone: string;
    };
    profile: {
      appSettings: string;
      editProfile: string;
      notFound: string;
      notFoundBody: string;
      backToFeed: string;
      followers: string;
      following: string;
      postsTab: string;
      publications: string;
      backHome: string;
      emptyOwnPosts: string;
      emptyOtherPosts: string;
    };
  };
}
