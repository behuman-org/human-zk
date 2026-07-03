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
  id: string;
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
    hackathon: string;
    hackathonUrl: string;
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
    common: {
      loading: string;
      close: string;
      verifyLink: string;
      verifyRequired: string;
      needVerifyGeneric: string;
      onChain: string;
      onChainPending: string;
      edit: string;
    };
    nav: {
      feed: string;
      threads: string;
      messages: string;
      notifications: string;
      settings: string;
      publish: string;
      profile: string;
      causes: string;
      articles: string;
      mainAria: string;
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
      eyebrow: string;
      title: string;
      subtitle: string;
      sortNew: string;
      sortHot: string;
      sortAria: string;
      loading: string;
      empty: string;
      errorLoad: string;
      retry: string;
      threadEyebrow: string;
      members: string;
      postsAria: string;
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
      logout: string;
      logoutHint: string;
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
      editModal: {
        save: string;
        avatarLegend: string;
        avatarColor: string;
        username: string;
        bio: string;
        handleNote: string;
      };
    };
    postMenu: {
      menuLabel: string;
      report: string;
      reported: string;
      reportSent: string;
      reportUnavailable: string;
      reportFailed: string;
      reportReason: string;
    };
    profileActions: {
      follow: string;
      following: string;
      message: string;
      menuLabel: string;
      report: string;
      reported: string;
      unfollowed: string;
      followed: string;
      followUnavailable: string;
      actionFailed: string;
      reportSent: string;
      reportUnavailable: string;
      reportFailed: string;
      reportReason: string;
    };
    causes: {
      eyebrow: string;
      title: string;
      subtitle: string;
      back: string;
      loadError: string;
      loadErrorHint: string;
      emptyTitle: string;
      emptyBody: string;
      ofGoal: string;
      funded: string;
      donor: string;
      donors: string;
      day: string;
      days: string;
      closed: string;
      viewCause: string;
      estApyTitle: string;
      states: {
        released: string;
        refunding: string;
        disputed: string;
        failed: string;
        reached: string;
        fundraising: string;
      };
      detail: {
        noDescription: string;
        raised: string;
        goal: string;
        funded: string;
        donors: string;
        daysLeft: string;
        yieldPerYear: string;
        verifyToParticipate: string;
        donateTitle: string;
        donateAnon: string;
        suggestedAmounts: string;
        otherAmount: string;
        donate: string;
        processing: string;
        stepProof: string;
        stepWallet: string;
        stepSending: string;
        thankYou: string;
        positionToday: string;
        viewTx: string;
        txSimulated: string;
        refund: string;
        validatorPanel: string;
        noMilestones: string;
        approve: string;
        releaseSigners: string;
        signerCause: string;
        signerPlatform: string;
        signerNeutral: string;
        releaseFunds: string;
        releaseRequires: string;
        fundsReleased: string;
        viewReleaseTx: string;
        opinionsTitle: string;
        opinionPlaceholder: string;
        sentimentSupport: string;
        sentimentOppose: string;
        sentimentNeutral: string;
        publishOpinion: string;
        busyRefund: string;
        busyOpinionProof: string;
        busyOpinionPublish: string;
        busyApprove: string;
        busyRelease: string;
        refundAlert: string;
        needVerifyParticipate: string;
        noValidatorPerm: string;
      };
    };
    articles: {
      eyebrow: string;
      title: string;
      subtitle: string;
      write: string;
      back: string;
      loadError: string;
      empty: string;
      onChainChip: string;
      onChainExpert: string;
      onChainPending: string;
      view: {
        opinions: string;
        opinionPlaceholder: string;
        opinionButton: string;
        verifyToOpine: string;
        busyOpinion: string;
        viewOnChain: string;
      };
      editor: {
        gateTitle: string;
        gateBody: string;
        eyebrow: string;
        title: string;
        subtitle: string;
        fieldTitle: string;
        titlePlaceholder: string;
        bannerLabel: string;
        uploadBanner: string;
        changeBanner: string;
        removeBanner: string;
        tabWrite: string;
        tabPreview: string;
        insertImage: string;
        markdownHint: string;
        previewEmpty: string;
        anchorTitle: string;
        anchorBody: string;
        quote: string;
        publish: string;
        alreadyAnchored: string;
        quoteFee: string;
        quoteRegister: string;
        quoteHashOnly: string;
        busyQuote: string;
        busyPublish: string;
        busySaving: string;
        needVerify: string;
        imageReadError: string;
        sampleMarkdown: string;
      };
    };
    postCard: {
      communityVote: string;
      voteUp: string;
      voteDown: string;
      viewProfile: string;
      moderationReview: string;
      resonate: string;
      resonateRemove: string;
      resonateAnon: string;
      reply: string;
      verifyOnChain: string;
      anchoring: string;
      viewOnChain: string;
    };
    postComposer: {
      ariaGeneral: string;
      ariaThread: string;
      hello: string;
      postingIn: string;
      inputAria: string;
      placeholderGeneral: string;
      placeholderThread: string;
      sending: string;
      publish: string;
    };
    postThread: {
      title: string;
      loading: string;
      notFound: string;
      replyTitle: string;
      replyPlaceholder: string;
      replyButton: string;
      verifyToReply: string;
      replies: string;
      repliesEmpty: string;
      busyReply: string;
      needVerify: string;
    };
    createThread: {
      title: string;
      create: string;
      name: string;
      namePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      error: string;
    };
    rightRail: {
      aria: string;
      edit: string;
    };
  };
}
