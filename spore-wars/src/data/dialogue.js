// All dialogue text keyed by civType and relationship tier

export const OPENING_MESSAGES = {
  military: {
    allied:   "Brother in arms. What do you need?",
    friendly: "Good to see you. What do you need?",
    neutral:  "State your business.",
    wary:     "You've got nerve showing up here.",
    hostile:  "You dare contact us?",
  },
  economic: {
    allied:   "Our best partner. Always good to hear from you.",
    friendly: "Always a pleasure. Let's make a deal.",
    neutral:  "We're listening. Make it worth our time.",
    wary:     "We don't forget who's been cutting into our territory.",
    hostile:  "Come to beg? Good.",
  },
  religious: {
    allied:   "The spirits rejoice. Speak freely, friend.",
    friendly: "The spirits smile on your arrival.",
    neutral:  "You seek counsel? Choose your words carefully.",
    wary:     "Your actions have not gone unnoticed.",
    hostile:  "The spirits demand retribution.",
  },
};

export const ACTION_RESPONSES = {
  request_military_assistance: {
    military: {
      allied:   "Consider it done. Point us at the enemy.",
      friendly: "We'll send forces. Don't make us regret it.",
      neutral:  "We fight for coin. Pay up and name your target.",
      wary:     "You want our soldiers? This will cost you dearly.",
    },
    economic: {
      allied:   "War is bad for business, but for you -- we'll make an exception.",
      friendly: "We prefer trade, but we can fund a campaign. Who's the target?",
      neutral:  "Military action is expensive. Our rates reflect that.",
      wary:     "We don't lend armies to borderline enemies. The price will sting.",
    },
    religious: {
      allied:   "Our warriors march under the spirits' blessing. Name the heretic.",
      friendly: "If your cause is just, our blades are yours.",
      neutral:  "The spirits weigh your request. The cost is steep.",
      wary:     "You ask much. The spirits demand tribute before they act.",
    },
  },

  offer_gift: {
    military: {
      allied:   "Appreciated, though unnecessary between allies.",
      friendly: "A worthy gesture.",
      neutral:  "Hmm. Perhaps you're not entirely useless.",
      wary:     "Trying to buy goodwill? It's a start.",
      hostile:  "This changes nothing.",
    },
    economic: {
      allied:   "You spoil us. We'll put it to good use.",
      friendly: "Excellent. This opens doors.",
      neutral:  "Acceptable. Let's see if the goodwill holds.",
      wary:     "Money talks. We're listening -- barely.",
      hostile:  "Not enough.",
    },
    religious: {
      allied:   "The spirits bless your generosity.",
      friendly: "An offering well received.",
      neutral:  "The spirits acknowledge your tribute.",
      wary:     "A start. The spirits require more.",
      hostile:  "Your gifts cannot undo your transgressions.",
    },
  },

  insult: {
    military: {
      friendly: "Push it and see what happens.",
      neutral:  "Bold words. Back them up.",
      wary:     "You've just made a powerful enemy.",
      hostile:  "Brave last words.",
    },
    economic: {
      friendly: "Careful. We have long memories and longer ledgers.",
      neutral:  "That'll cost you.",
      wary:     "Big mistake. We'll make sure everyone knows.",
      hostile:  "Enjoy your poverty.",
    },
    religious: {
      friendly: "The spirits note your disrespect.",
      neutral:  "Blasphemy has consequences.",
      wary:     "You seal your own fate.",
      hostile:  "The spirits have heard enough.",
    },
  },

  declare_war: {
    military: {
      neutral:  "Finally some honesty. Let's end this.",
      wary:     "We've been waiting for you to say that.",
      hostile:  "Good. No more talk.",
    },
    economic: {
      neutral:  "You'll regret the lost revenue.",
      wary:     "You're going to pay for this -- literally.",
      hostile:  "We've already frozen your accounts.",
    },
    religious: {
      neutral:  "A holy war then. So be it.",
      wary:     "The spirits have already judged you.",
      hostile:  "The reckoning has come.",
    },
  },
};

// Actions available per relationship tier
export const TIER_ACTIONS = {
  allied:   ['request_military_assistance', 'offer_gift'],
  friendly: ['request_military_assistance', 'offer_gift', 'insult'],
  neutral:  ['request_military_assistance', 'offer_gift', 'insult', 'declare_war'],
  wary:     ['request_military_assistance', 'offer_gift', 'insult', 'declare_war'],
  hostile:  ['insult', 'declare_war'],
};

// Human-readable action labels for UI buttons
export const ACTION_LABELS = {
  request_military_assistance: 'Military Aid',
  offer_gift: 'Give Gift',
  insult: 'Insult',
  declare_war: 'Declare War',
};
