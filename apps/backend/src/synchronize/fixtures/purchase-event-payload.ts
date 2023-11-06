import type {
  MarketplacePurchaseChangedEvent,
  MarketplacePurchasePurchasedEvent,
} from "@octokit/webhooks-types";

export const USER_PURCHASE_EVENT_PAYLOAD: MarketplacePurchasePurchasedEvent = {
  action: "purchased",
  effective_date: "2022-08-10T00:00:00+00:00",
  sender: {
    login: "jsfez",
    id: 15954562,
    avatar_url: "https://avatars.githubusercontent.com/u/15954562?v=4",
    gravatar_id: "",
    url: "https://api.github.com/users/jsfez",
    html_url: "https://github.com/jsfez",
    followers_url: "https://api.github.com/users/jsfez/followers",
    following_url: "https://api.github.com/users/jsfez/following{/other_user}",
    gists_url: "https://api.github.com/users/jsfez/gists{/gist_id}",
    starred_url: "https://api.github.com/users/jsfez/starred{/owner}{/repo}",
    subscriptions_url: "https://api.github.com/users/jsfez/subscriptions",
    organizations_url: "https://api.github.com/users/jsfez/orgs",
    repos_url: "https://api.github.com/users/jsfez/repos",
    events_url: "https://api.github.com/users/jsfez/events{/privacy}",
    received_events_url: "https://api.github.com/users/jsfez/received_events",
    type: "User",
    site_admin: false,
    email: "jeremy@smooth-code.com",
  },
  marketplace_purchase: {
    account: {
      type: "User",
      id: 15954562,
      node_id: "MDQ6VXNlcjE1OTU0NTYy",
      login: "jsfez",
      organization_billing_email: "jsfez@test.com",
    },
    billing_cycle: "monthly",
    unit_count: 1,
    on_free_trial: false,
    free_trial_ends_on: null,
    next_billing_date: "2022-09-05T00:00:00+00:00",
    plan: {
      id: 7766,
      name: "Free",
      description: "Unlimited screenshots diff for free.",
      monthly_price_in_cents: 0,
      yearly_price_in_cents: 0,
      price_model: "free",
      has_free_trial: false,
      unit_name: null,
      bullets: [],
    },
  },
};

export const USER_PURCHASE_EVENT_PAYLOAD_2: MarketplacePurchasePurchasedEvent =
  {
    action: "purchased",
    effective_date: "2022-12-21T00:00:00+00:00",
    sender: {
      login: "bubafinder",
      id: 41724080,
      avatar_url: "https://avatars.githubusercontent.com/u/41724080?v=4",
      gravatar_id: "",
      url: "https://api.github.com/users/bubafinder",
      html_url: "https://github.com/bubafinder",
      followers_url: "https://api.github.com/users/bubafinder/followers",
      following_url:
        "https://api.github.com/users/bubafinder/following{/other_user}",
      gists_url: "https://api.github.com/users/bubafinder/gists{/gist_id}",
      starred_url:
        "https://api.github.com/users/bubafinder/starred{/owner}{/repo}",
      subscriptions_url:
        "https://api.github.com/users/bubafinder/subscriptions",
      organizations_url: "https://api.github.com/users/bubafinder/orgs",
      repos_url: "https://api.github.com/users/bubafinder/repos",
      events_url: "https://api.github.com/users/bubafinder/events{/privacy}",
      received_events_url:
        "https://api.github.com/users/bubafinder/received_events",
      type: "User",
      site_admin: false,
      email: "lovric.split@gmail.com",
    },
    marketplace_purchase: {
      account: {
        type: "User",
        id: 41724080,
        node_id: "MDQ6VXNlcjQxNzI0MDgw",
        login: "bubafinder",
        organization_billing_email: "bubafinder@test.com",
      },
      billing_cycle: "monthly",
      unit_count: 1,
      on_free_trial: false,
      free_trial_ends_on: null,
      next_billing_date: "2022-12-21T00:00:00+00:00",
      plan: {
        id: 7766,
        name: "Free",
        description: "5,000 screenshots / month",
        monthly_price_in_cents: 0,
        yearly_price_in_cents: 0,
        price_model: "FREE",
        has_free_trial: false,
        unit_name: null,
        bullets: [
          "Up to 5,000 screenshots / month",
          "Unlimited users and repositories",
          "Unlimited screenshots for public repositories",
        ],
      },
    },
  };

const ORGANIZATION_ACCOUNT = {
  type: "Organization",
  id: 777888999,
  login: "smooth-code",
  organization_billing_email: "contact@smooth-code.com",
};

export const ORGANIZATION_PURCHASE_EVENT_PAYLOAD: MarketplacePurchasePurchasedEvent =
  {
    ...USER_PURCHASE_EVENT_PAYLOAD,
    marketplace_purchase: {
      ...USER_PURCHASE_EVENT_PAYLOAD.marketplace_purchase,
      account: {
        ...USER_PURCHASE_EVENT_PAYLOAD.marketplace_purchase.account,
        ...ORGANIZATION_ACCOUNT,
      },
    },
  };

export const ORGANIZATION_UPDATE_PURCHASE_EVENT_PAYLOAD: MarketplacePurchaseChangedEvent =
  {
    action: "changed",
    effective_date: "2022-12-21T00:00:00+00:00",
    sender: {
      login: "mfranzs",
      id: 953103,
      avatar_url: "https://avatars.githubusercontent.com/u/953103?v=4",
      gravatar_id: "",
      url: "https://api.github.com/users/mfranzs",
      html_url: "https://github.com/mfranzs",
      followers_url: "https://api.github.com/users/mfranzs/followers",
      following_url:
        "https://api.github.com/users/mfranzs/following{/other_user}",
      gists_url: "https://api.github.com/users/mfranzs/gists{/gist_id}",
      starred_url:
        "https://api.github.com/users/mfranzs/starred{/owner}{/repo}",
      subscriptions_url: "https://api.github.com/users/mfranzs/subscriptions",
      organizations_url: "https://api.github.com/users/mfranzs/orgs",
      repos_url: "https://api.github.com/users/mfranzs/repos",
      events_url: "https://api.github.com/users/mfranzs/events{/privacy}",
      received_events_url:
        "https://api.github.com/users/mfranzs/received_events",
      type: "User",
      site_admin: false,
      email: "mfranzs123@gmail.com",
    },
    marketplace_purchase: {
      account: {
        type: "Organization",
        id: 65213452,
        node_id: "MDEyOk9yZ2FuaXphdGlvbjY1MjEzNDUy",
        login: "remnoteio",
        organization_billing_email: "support@remnote.io",
      },
      billing_cycle: "monthly",
      unit_count: 1,
      on_free_trial: false,
      free_trial_ends_on: null,
      next_billing_date: "2022-12-22T00:00:00+00:00",
      plan: {
        id: 7770,
        name: "Starter",
        description: "40,000 screenshots / month",
        monthly_price_in_cents: 10000,
        yearly_price_in_cents: 110000,
        price_model: "FLAT_RATE",
        has_free_trial: false,
        unit_name: null,
        bullets: [
          "Up to 40,000 screenshots / month",
          "Unlimited users and repositories",
          "Unlimited screenshots for public repositories",
        ],
      },
    },
    previous_marketplace_purchase: {
      account: {
        type: "Organization",
        id: 65213452,
        node_id: "MDEyOk9yZ2FuaXphdGlvbjY1MjEzNDUy",
        login: "remnoteio",
        organization_billing_email: "support@remnote.io",
      },
      billing_cycle: "monthly",
      on_free_trial: false,
      free_trial_ends_on: null,
      unit_count: 1,
      plan: {
        id: 7766,
        name: "Free",
        description: "5,000 screenshots / month",
        monthly_price_in_cents: 0,
        yearly_price_in_cents: 0,
        price_model: "FREE",
        has_free_trial: false,
        unit_name: null,
        bullets: [
          "Up to 5,000 screenshots / month",
          "Unlimited users and repositories",
          "Unlimited screenshots for public repositories",
        ],
      },
    },
  };