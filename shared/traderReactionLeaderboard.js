/**
 * shared/traderReactionLeaderboard.js — GENERATED FILE, do not edit by hand.
 *
 * Source: scripts/analyze-trader-reactions.mjs (live Gamma + AviationWeather METAR
 * + Data API v2 trades/prices-history). No users are fabricated: every row is a
 * real proxy wallet observed trading a target bracket around a METAR warming node.
 *
 * generatedAt: 2026-11-12T12:09:40.769Z
 * events: 17 analysed / 21 selected
 * warming nodes: 78 found, 28 qualified (baseline + reprice)
 * users: 225 wallets with >=1 qualified observation; eligible: 0
 * definition: ahead = direction-correct trade (BUY YES or SELL NO target) inside
 * node ±120s and strictly before the first >= max(0.05, 2 ticks) target reprice;
 * qualified (per wallet) = number of qualified nodes where the wallet traded the
 * target at all (shown as `involved`); reactionRate denominator = all qualified nodes.
 */

export const TRADER_REACTION_LEADERBOARD = {
  "generatedAt": "2026-11-12T12:09:40.769Z",
  "qualifiedWarmingNodes": 28,
  "users": [
    {
      "wallet": "0x758dac51ba3cc9a246a79787da9df11c5f425d9e",
      "pseudonym": "These-Latency-Perspective",
      "reactionRate": 0.285714,
      "per100": 28.571,
      "ahead": 8,
      "qualified": 28,
      "wilsonLower": 0.152538,
      "eligible": false
    },
    {
      "wallet": "0x005ed998fcb786679eb8bfd0d20c15c0903d6d8e",
      "pseudonym": "Pricey-Million",
      "reactionRate": 0.178571,
      "per100": 17.857,
      "ahead": 5,
      "qualified": 28,
      "wilsonLower": 0.078784,
      "eligible": false
    },
    {
      "wallet": "0x1ffaaec2600c2a3957779304f404f390d365cd11",
      "pseudonym": "Arid-Nurse",
      "reactionRate": 0.178571,
      "per100": 17.857,
      "ahead": 5,
      "qualified": 28,
      "wilsonLower": 0.078784,
      "eligible": false
    },
    {
      "wallet": "0x4e72c22cd76f9973a48aedfd79feeaacc8b7ffb9",
      "pseudonym": "Shallow-Diadem",
      "reactionRate": 0.178571,
      "per100": 17.857,
      "ahead": 5,
      "qualified": 28,
      "wilsonLower": 0.078784,
      "eligible": false
    },
    {
      "wallet": "0xe28db285fa8acdf73eb9d184627a1924bc7d9c81",
      "pseudonym": "Huge-Airfield-Conspiracy",
      "reactionRate": 0.178571,
      "per100": 17.857,
      "ahead": 5,
      "qualified": 28,
      "wilsonLower": 0.078784,
      "eligible": false
    },
    {
      "wallet": "0x53b933bec5f65d5363ee1041050d265517964b3d",
      "pseudonym": "Minor-Television",
      "reactionRate": 0.142857,
      "per100": 14.286,
      "ahead": 4,
      "qualified": 28,
      "wilsonLower": 0.056989,
      "eligible": false
    },
    {
      "wallet": "0x5a1ee055356e6750647acead0e03bd0c3833fa69",
      "pseudonym": "Zesty-Restroom-Overshoot",
      "reactionRate": 0.142857,
      "per100": 14.286,
      "ahead": 4,
      "qualified": 28,
      "wilsonLower": 0.056989,
      "eligible": false
    },
    {
      "wallet": "0x69f0c154a3412f2b3fa7eb22c6d08e6b5b32fb27",
      "pseudonym": "Spotless-Investigator-Overcoat",
      "reactionRate": 0.142857,
      "per100": 14.286,
      "ahead": 4,
      "qualified": 28,
      "wilsonLower": 0.056989,
      "eligible": false
    },
    {
      "wallet": "0xb2e42d29690b7b63335a03c0fd5e64df0681b7f1",
      "pseudonym": "Exciting-Hat-Vegetarian",
      "reactionRate": 0.142857,
      "per100": 14.286,
      "ahead": 4,
      "qualified": 28,
      "wilsonLower": 0.056989,
      "eligible": false
    },
    {
      "wallet": "0xeb68675c06e0bb9f08ba510550912d77289ce362",
      "pseudonym": "Limping-Baggie-Technique",
      "reactionRate": 0.142857,
      "per100": 14.286,
      "ahead": 4,
      "qualified": 28,
      "wilsonLower": 0.056989,
      "eligible": false
    },
    {
      "wallet": "0x0172d9aea5b523c33955c0e9841d9a6af82d4e84",
      "pseudonym": "Back-Nod-Wiseguy",
      "reactionRate": 0.107143,
      "per100": 10.714,
      "ahead": 3,
      "qualified": 28,
      "wilsonLower": 0.037118,
      "eligible": false
    },
    {
      "wallet": "0x1abc2b469b5ded495d6c8b21fc79dcb8d8f345e7",
      "pseudonym": "Pure-Eyeliner",
      "reactionRate": 0.107143,
      "per100": 10.714,
      "ahead": 3,
      "qualified": 28,
      "wilsonLower": 0.037118,
      "eligible": false
    },
    {
      "wallet": "0x33c8f2e65c1ffc09a7af6ad0bfc6987a4db1de24",
      "pseudonym": "Well-Lit-Dose-Raisin",
      "reactionRate": 0.107143,
      "per100": 10.714,
      "ahead": 3,
      "qualified": 28,
      "wilsonLower": 0.037118,
      "eligible": false
    },
    {
      "wallet": "0x43cb4ae1f4ddc9e671486c79c9f40a6fd98b84df",
      "pseudonym": "Fair-Tan",
      "reactionRate": 0.107143,
      "per100": 10.714,
      "ahead": 3,
      "qualified": 28,
      "wilsonLower": 0.037118,
      "eligible": false
    },
    {
      "wallet": "0x5a218c7ad04135830a45c41aaed7294df7809318",
      "pseudonym": "Sparse-Cookie",
      "reactionRate": 0.107143,
      "per100": 10.714,
      "ahead": 3,
      "qualified": 28,
      "wilsonLower": 0.037118,
      "eligible": false
    },
    {
      "wallet": "0x9b129ad05bc0a8df3c73dfcc66fe75252daec2d5",
      "pseudonym": "Hasty-Worker",
      "reactionRate": 0.107143,
      "per100": 10.714,
      "ahead": 3,
      "qualified": 28,
      "wilsonLower": 0.037118,
      "eligible": false
    },
    {
      "wallet": "0x164cb85e1718d0a8f95d588b08fbb52b34233e39",
      "pseudonym": "Essential-Shell",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0x2337c02337374860b1859ea417b379db7e3c697e",
      "pseudonym": "Unlucky-Core-Criterion",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0x266fc3ee8fc646ff9606b0569e5533c4d7d1c608",
      "pseudonym": "Bewitched-Greatgrandmother-Service",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0x3135a496407140fe26c1fcae1d2814b228d5cc2d",
      "pseudonym": "Feline-Tool",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0x3653235d75a0d5969c42f7514d4df8ea5f8cef74",
      "pseudonym": "Knowing-Arthur-Ash",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0x496f76bd5cf4c2819c710ae90ed1c84b2dc6fa5d",
      "pseudonym": "Bland-Dynamite",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0x6891589732cf8beaaf424b117d5c5c20919f6bb9",
      "pseudonym": "Charming-Kidney-Imagination",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xaa930fdc4caa3c0f6067404a7bd7899ca45f0bc7",
      "pseudonym": "Bowed-Jam",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xb123e75212e81277b38aa4ed100f0f0379958e0e",
      "pseudonym": "",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xb40e89677d59665d5188541ad860450a6e2a7cc9",
      "pseudonym": "Entire-Hood",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xba168a94fa230f0fdee8d2b903a11343631b3289",
      "pseudonym": "Another-Duckling",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xcd154f053a291f46e550d5fbcd4cfa7ddbc4b352",
      "pseudonym": "Self-Assured-Laparoscope",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xd71776a8d4fddeb3c150c4607b3f8bec31213b85",
      "pseudonym": "Radiant-Nonbeliever",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xd7c32a6e12077a51d8f90d3e2b97f0f5234436dd",
      "pseudonym": "Utilized-Epic-Snorer",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xe3eb836b52c0dcbe23dc81d81d212aa79dda69e8",
      "pseudonym": "Previous-Marshmallow-Offer",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0xf063aee45ba812a95c46ac391779bc5edc14ab75",
      "pseudonym": "Low-Interface",
      "reactionRate": 0.071429,
      "per100": 7.143,
      "ahead": 2,
      "qualified": 28,
      "wilsonLower": 0.019812,
      "eligible": false
    },
    {
      "wallet": "0x0a16c6d4ae468403b54efd9c274756e2be4e6004",
      "pseudonym": "Unlawful-Bone",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x0ab09357f1470c72604d3cc9d848247a00846580",
      "pseudonym": "Competent-Hotel",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x104dcddf8a7353afca1daa4b0da2b4c0bf605abb",
      "pseudonym": "Noted-Validate-Drink",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x122cb94c437ea5e6f088c6c0c143c592ab8efbed",
      "pseudonym": "Careful-Bunch",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x165915c6df220109589b90b0b5d5cd81420542f8",
      "pseudonym": "Warped-Circuit",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x1f85eb9c455c5bdef5d96c2739076678c7157b02",
      "pseudonym": "Comfortable-Sandwich",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x21f688f876a76e7bda1c6dce24806b903043af55",
      "pseudonym": "Familiar-Textbook",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x242ede05a7d295f20043bb5181816a9471ccd2f9",
      "pseudonym": "Diligent-Memory",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x2a532cd41e91fb85f9000b032197590384c45229",
      "pseudonym": "Magnificent-Luxury",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x2ebbcf7d965c2e700fa715f737ac6b93f23435d7",
      "pseudonym": "Sarcastic-Garb",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x31a7111832ce43f3e196b96da09691bb099ca883",
      "pseudonym": "Runny-Medal-Zither",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x39fb644e883aa4f9742e478d4c863e5bea272c0c",
      "pseudonym": "Elderly-Soldier",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x3a672173ad59d77fab4eda54bc5bd8a7e8fd6095",
      "pseudonym": "Worldly-Glutamate",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x3d3171c2aa20f36feb5cac0d492a8048ab9513c3",
      "pseudonym": "Prudent-Morsel-Million",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x40be599a6e7b50e7aacb593a6427d5fa06a3e067",
      "pseudonym": "Filthy-Tights",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x44c99903c2bd52c86372196d157f6910cea5d3b7",
      "pseudonym": "Somber-Training",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x48ef33db14a90d732a5799b9acbe4b39208fc476",
      "pseudonym": "Mellow-Leaver-Ambiguity",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x49b2ad2275b62c79ddc653fd4eaf2f88173fa6da",
      "pseudonym": "Giddy-Inquiry",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x501c9ecce9236992794cd12e88d22355e6454d6d",
      "pseudonym": "Impeccable-Cycle",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x5a88ef7972375b77df48c2b4aad991abede9f471",
      "pseudonym": "Extra-Small-Tool",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x5bcfd34e00df94ac97b5c51b408a436df3380aa2",
      "pseudonym": "Neglected-Impress",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x5f3ee9c40be255d1c18ca38bf4ab94b564c75337",
      "pseudonym": "Standard-Jackal",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x664159cf9fdde4454c5000dce2ec300c330699f9",
      "pseudonym": "Opulent-Fritter",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x74957ea27ac4fbdee46d861fdae357859ff67fcf",
      "pseudonym": "Evil-Row",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x7b9acdd4c8e0bf2e82f1a41e2f706b1498f97908",
      "pseudonym": "",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x7eeb94f2d5a474123e260f160b4f15d3f3eab6bd",
      "pseudonym": "Prize-Standing",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x7f1a86d1a631caa318abd40649215d7df05cf34c",
      "pseudonym": "Twin-Artificer-Ambulance",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x7ff115c16042a4dfd58db9eb3b64faeb5f9ce002",
      "pseudonym": "Snoopy-Investor",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x803a112b5eb1404eea463b26a2318cfcb3b9219e",
      "pseudonym": "Revolving-Term",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x8166f8cf72cbaf16d1763e8bdb4eb04ead59d201",
      "pseudonym": "Quarrelsome-Root",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x82dfc3b46c414a5de1c8d9b2598f8f0a3c680f66",
      "pseudonym": "Stormy-Landform",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x8b1b891e7198d91fb763cf50828205c8cf7f2cae",
      "pseudonym": "Hasty-Signet",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x8b8b9c565c8dca43cfb767f0f2c20b2b323d2512",
      "pseudonym": "Classic-Loggia",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x8bd872ec2819336df7c7ae2c10fb30bf1ac79927",
      "pseudonym": "Delightful-Sideboard",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x9009e9ddff124c51b91a8eb0726dd892d25facb2",
      "pseudonym": "",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x93dd5294fbf8c35190c4616ecc63d9cf88e34ed5",
      "pseudonym": "Merry-Stump-Loft",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x9892ef52593bf4407e1ffcea509516bafa53fd59",
      "pseudonym": "Chilly-Harpsichord",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x997ef486d2a5513069bf4aa089e6293e56297e58",
      "pseudonym": "Extraneous-Truth",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x9c237ad435792d8d435bb7df9105330640597c89",
      "pseudonym": "Gregarious-Degradation",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x9c805e4b6c314f59402caf18c932058e7537814b",
      "pseudonym": "Perky-Criterion-Lettuce",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xa0161e41c059c3c6662d96f7f07226dbfb6067c2",
      "pseudonym": "Puny-Sandpaper-Dromedary",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xa26f65f33dcac856c0916bca49f9c03464e8e9bf",
      "pseudonym": "Joint-Wage",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xa3a76757332db1030962fa94afb1f6ca453ddfb2",
      "pseudonym": "Vain-Scissors",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xa63ec2275675900082115afcff5d565caee0c0d6",
      "pseudonym": "Worrisome-Duck-Razor",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xa8171c1b8acf891e18a83f6f8f1fdb7bd7ec95d7",
      "pseudonym": "Beautiful-Atmosphere",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xace0a40e94a4d58d6c9381c316e40f38e4bd9c90",
      "pseudonym": "Ugly-Element-Path",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xae3ed6ae3eee2be5ab95095e15d4ed3a0b679a8c",
      "pseudonym": "Another-Decision-Tomography",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xaec03beedc9deabda826d73e5bacef66cb7d1cdd",
      "pseudonym": "Calculating-Species-Selection",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xafde461fce5aa0fabdb7711c59db93b65e343e1d",
      "pseudonym": "Whole-Challenge",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xb3b449c88c717d1b4b799d351160d600162748b2",
      "pseudonym": "Glorious-Median",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xb4a0f89d213e065ccafc8b68d3c964e091ab9d29",
      "pseudonym": "Respectful-Altitude",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xb64e609fdbd09cfc77cabc8eba3316f0bddd8e0d",
      "pseudonym": "Poor-Making-Thigh",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xbc3c7806dbbc3265cf3bc79b024386171fb50777",
      "pseudonym": "Unwelcome-Plaintiff-Photograph",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xbd71233ab7a25bc420929cd67476219762f31281",
      "pseudonym": "",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xbd7387cc09d32bd8f7644be95e7b20a2de6b2e72",
      "pseudonym": "Clear-Thorn",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xbda9cd0a14406821abfe696672231d7af67a7009",
      "pseudonym": "Staid-Molding-Shopping",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xc31fdeab99cc3a1ff67f42cf5dbdde35dce0f04a",
      "pseudonym": "Misguided-Nightclub",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xcb5151339e09e1cd97714f3ae5df62c5b6a32d79",
      "pseudonym": "Weighty-Stream-Discretion",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xcc4fb4f9dd0405a971f992f4cba0011fab1e4926",
      "pseudonym": "Healthy-Textual",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xcdac8676b0ecb9533c9aa9873b3473f5519f5db3",
      "pseudonym": "",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xd1156233fca80629cbf6ce80d86a019e04e74906",
      "pseudonym": "Grubby-Aquarium",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xd3942296f38a1a916cb8ea2656cfb0d2c5987e90",
      "pseudonym": "Uncomfortable-Mountain-Dragonfruit",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xd7b699d42ca107b8272067d08a396856c6e22ccd",
      "pseudonym": "These-Woodshed",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xd91e4f1b1490cff64477c039ee7e53ab9cdabf1d",
      "pseudonym": "Spiffy-Sailboat",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xd9fe6f0f41ca99fefa93c55d8890000e5a84db0d",
      "pseudonym": "Prestigious-Zephyr-Jail",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xda35f97698382ca11bc60b731f0692659cf6b2db",
      "pseudonym": "Frank-Specification",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xdbb758b439f6d72c9e7d4374095de8be3c3c8296",
      "pseudonym": "Brief-Affinity",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xdd704b471041b806b65d04a3b48f5aa953811d06",
      "pseudonym": "",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xe3d6f6d313776c8f42e53f10915d7da35bd63955",
      "pseudonym": "Perky-Scheme",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xe419ed7a60b7cd0faac6bd55c59084f3b81e8aed",
      "pseudonym": "Wet-Framework",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0xf600e8c0bf83c001786c3784cf7eec8e8ce53aaa",
      "pseudonym": "Outrageous-Pet-Giraffe",
      "reactionRate": 0.035714,
      "per100": 3.571,
      "ahead": 1,
      "qualified": 28,
      "wilsonLower": 0.006332,
      "eligible": false
    },
    {
      "wallet": "0x05f8cfd33d0a36100e9608e7c4989b0afdb5c181",
      "pseudonym": "Crafty-Loading",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0857bb24b2e3dc1385a8eb4c6911c599dbb9c3d7",
      "pseudonym": "Black-Hub",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0ac73c23d2d19d9bf6dc581e7529947ccf0bdd80",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0be07ac912dbd6a770c68b88536dc917900051ca",
      "pseudonym": "Deficient-Heating",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1062195479bb686e8a90c926c4c595ee2e1d17e5",
      "pseudonym": "Pointed-Handrail",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x16c7337106a0b3a06ff863a1c06d8e2cbf7322cd",
      "pseudonym": "Colossal-Bookcase-Saloon",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1775de4e5311e4f9f650fc5aa5dbf708a431e3c0",
      "pseudonym": "Similar-Decline",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x17dd123a0ad9675e6ed3155724a92b4632af944c",
      "pseudonym": "Decimal-Phosphate-Marriage",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x19bbf4fddca1a201bc9a657ca84dea7a455158d5",
      "pseudonym": "Knowing-Freon-Linguistics",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1f0754eb8b460dc7df947014b617e51015717573",
      "pseudonym": "Thoughtful-Legitimacy-Government",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x21168b1447aea2cdd4746cea893b38c50876eb8f",
      "pseudonym": "Querulous-Pincenez",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x229c0a7d92977a9934e5ac2348d507988996b966",
      "pseudonym": "Stale-Cashew",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2532e2d26dfad61379169efea17fe6112d4e28ba",
      "pseudonym": "Glaring-Player",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x286882251a071ba20cfbfe4b128eb55bcad597f8",
      "pseudonym": "Worthless-Biopsy-Monkey",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x29863c41d339ba0710b7b023cb5a2e2d70c3b3a9",
      "pseudonym": "Evil-Watcher",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2a6f7b6306c81908a1a25fbeef624d6fe1db2351",
      "pseudonym": "Famous-Sadness-Buck",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2bf2b521b2cb09806666c40fd78f216a819dee1c",
      "pseudonym": "Shallow-Sunset",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2bfd3738d0298174dfa80a1202f8156fa739c4cd",
      "pseudonym": "Blue-Hug",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2d2d2b32e5199edf833594a99b9c54e5668ab69d",
      "pseudonym": "Forthright-Geyser",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2d88999526d88c045404f185bc1ecbca91c36ade",
      "pseudonym": "Dry-Junk",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2e164514058e7d78ac5f5a38de41619c187d27c0",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2ef2f13f30e523197e9e66afa2f2620f02fbfaa5",
      "pseudonym": "Academic-Hubris",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x30236b29df89a7f203c027f58f62450f5b0b465c",
      "pseudonym": "Cute-Kid",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x30c53317fc15d7eb8acde5c259a63d1ac0c38511",
      "pseudonym": "Blaring-Sparrow",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x31a47ac5c37891a38c971ee497f1883bbf4edd86",
      "pseudonym": "Low-Selfesteem",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3252129ff9529fef42ca248d89ce7931d251e247",
      "pseudonym": "Itchy-Sleuth",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x33151ea579904d4cefe51590b5efb26f1f1f2282",
      "pseudonym": "Showy-Timeline",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x34c4fadc63a048d748a8809cad47350647e674b2",
      "pseudonym": "Elementary-Ownership-Vest",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3504755541dfe2a3ffd844ecb6ba2ca25bf5a832",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x35b3d88ef22fea4be0e97d67103e5e32440c8d9b",
      "pseudonym": "Carefree-Strike",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x373e1cc0a2d1b650942bfaec8eafcbf2c756b868",
      "pseudonym": "Plush-Reindeer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3970ce9259501e736a4a1bfcd6e643d68a28f56b",
      "pseudonym": "Useless-Adaptation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3a0a85fd0c91fb7a7123cd709f33a3e51e0737c6",
      "pseudonym": "Insignificant-Survivor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3c1de4456f7a18addc8b28adcb194b2eb061da77",
      "pseudonym": "Spherical-Balaclava",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3f8f6cf7ed5117aa10b15f99614989443fa783f9",
      "pseudonym": "Perfumed-Sale-Mezzanine",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4ac44393954b5e4d31a40a6f25d8c8d170033ab4",
      "pseudonym": "Weak-Outlet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4addc66860b349959cb5070a83dbd9eeb6836fe5",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4f0f8a24fd98ec9e152eeb98d4745a3436d76f7e",
      "pseudonym": "Partial-Surgery",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x50056e920328c27acbdc21d74cf3ffce52e723fe",
      "pseudonym": "Unsung-Greatness",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x50f494c2a44d7bff376b8c817ce83b162431b9eb",
      "pseudonym": "Flimsy-Marathon",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x532b5437c9e83a35554b3daf6057acb40222cccc",
      "pseudonym": "Humiliating-Bed",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x55332464a4d4fae19956d740dddff103918251ba",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x56341628a05932e7fa933bbd082411942d678c9b",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x58f7fa40e869d90d6392cf883af0af38df3fe70d",
      "pseudonym": "Raw-Millisecond-Wallet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5a83009fa6c4fcf4c0eef638b7f2bfb5dd27497d",
      "pseudonym": "Prudent-Mileage",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5b6e9bce6d8a533017e7f16987c9854c5da955b9",
      "pseudonym": "Instructive-Larch",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5b94b1181d238bfbd52391408c7f8c3aac67c769",
      "pseudonym": "Absolute-Chowder-Saloon",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5bb3c034a9078b5f3b2f91e0aa59e9cd03c42c94",
      "pseudonym": "That-Corsage-Vaccine",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5c3e96322be0a930ca581ca938fdab2716a5a917",
      "pseudonym": "Enormous-Burrito",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5cf37ddc5ab0758df78ad1fc9146c04c8475fc86",
      "pseudonym": "Ancient-Organ",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5d1048f76c13558f9c3a25685d960357957edca1",
      "pseudonym": "Honorable-Dinghy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5f2e619c63b57c1392c00ce1c860acb77cf2e381",
      "pseudonym": "Wonderful-Crusader-Hunter",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5f612351a9e46afbe3f164473a7d77a69ec9840a",
      "pseudonym": "Alarmed-Riser",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5fe79a73af0a8ad6a83d89256026b14f35981ea9",
      "pseudonym": "Focused-Monger",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x63540a1a71d2c0f01ed8676c1086b1625b4ea1c0",
      "pseudonym": "Muted-Handball",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x65e47ca19dbe03a20e02e2bbd3493808c59fd28f",
      "pseudonym": "Uniform-Sir-Tiara",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x65e6f32a21c333f81c5292ea7235d96c63803289",
      "pseudonym": "Faraway-Tabby",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6bc5d4869bc65e55eec9a1e46d69f2edeb6e33d3",
      "pseudonym": "Selfish-Disco",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6beefb1c8d4b91b9b6d437840c241e74e6997e78",
      "pseudonym": "Elderly-Reveal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6c06bb8ccea81d94f0f5681235c155836f00171d",
      "pseudonym": "Useful-Teen",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x70e2b50b888d76e9a279bdccb8da451e9a4667b4",
      "pseudonym": "Calculating-Spectacle-Hail",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x75db6a5505d7e7f9ad00352ec9e71e2f8ec3844f",
      "pseudonym": "Firm-Accessory-Advocacy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7610846dab85ae186292f817b0a653ba4b39e332",
      "pseudonym": "Careless-Locket",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x77d65d6235102dfc241b59dfd32d6125ff4d1d8c",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x77f069c3233901628c89d0e8ea5bb510a2822b1f",
      "pseudonym": "Educated-Jodhpurs",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x78ed8966161ea0a22f0719b9c04391c6ac22ab3a",
      "pseudonym": "Sarcastic-Termite",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7ab34ead62c51889ed6439eeef7f7e9cb343c4a1",
      "pseudonym": "Subdued-Corporal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7bbe0987962a6cd2728d1656e0465e7fa8cab95e",
      "pseudonym": "Sizzling-Paramedic-Collector",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7c72a056cff0b1e2791b32eab5fa420b1df0825e",
      "pseudonym": "Careful-Cargo",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7f3125861e9386bc4905169174c79e1b46af9d81",
      "pseudonym": "Solid-Birthday",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7f7dd2cee82e88ffa79ed5b45b869f0617840360",
      "pseudonym": "Advanced-Marionberry-Observatory",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x80316a4e38c8826f7e84c90083edd98cf2d9c84c",
      "pseudonym": "Unfinished-Precedence",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x804a67cb683b4dac9ddbc13d2dea2328bfcca3d9",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x874d9473aefc51bd153eb7eb5cd0a1d8ed467fd8",
      "pseudonym": "Fancy-Maelstrom",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x87650b9f63563f7c456d9bbcceee5f9faf06ed81",
      "pseudonym": "Straight-Wrinkle",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x879d999541ea4b50b7c237092cfc2b5f8a1fb501",
      "pseudonym": "Big-Hearted-Prescription",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8a25f9c7d093089c808f514b161a1e40be44ba81",
      "pseudonym": "Shameful-Dictionary",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8a9245eb0679238f1be4b99f09ae63b7c49d8586",
      "pseudonym": "Untidy-Link",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8ab498d2aa467e5dfc05db2b2cd300b237616f38",
      "pseudonym": "Profuse-Gravitas",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8b92f291ebe788de0cc4d2bd2617336354e26866",
      "pseudonym": "Fatal-Stopsign-Rabbi",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8dc6b0357089f3543bf286bd4252f64a912e22a3",
      "pseudonym": "Scholarly-Denim",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8ed6ae93fd7c966cf001bb0586417fbcc09487d4",
      "pseudonym": "Traumatic-Addition-Iridescence",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8fe730b55cf3468c01a884cfcde79c2dfb4d6c1f",
      "pseudonym": "Powerful-Waste",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x92d26e16356b646ad22233b490ffa54355f62d7d",
      "pseudonym": "Mindless-Date",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x937bcac3a8a30c07d827ad0550c3fe3a6756bfab",
      "pseudonym": "Abandoned-Pipe",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9732f622c04d7d91dc0637fe0b6c7ae02d62cd57",
      "pseudonym": "Irritating-Anchovy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9a94e5b4f0d6c646ed49e832cf8142c45474d5f9",
      "pseudonym": "Nonstop-Knitting",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9ba7e68ce42e6ba307f6545e3ad89d3d8bbeb5fb",
      "pseudonym": "Quintessential-Cricket",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9be90ea78bff3f81f3564a11d5e12b2a0783c030",
      "pseudonym": "Second-Fabric",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaba743a752406e6ed8e992c7a3f8e2217c6a85ed",
      "pseudonym": "Harmful-Commercial",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xabebab465b5aa530314a674e013f00c31bf78698",
      "pseudonym": "Trivial-Dress",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xafd5274522c6ee21489a85d23e4036e4dad062f3",
      "pseudonym": "Royal-Kite",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb0c85813a7a4428f1139ff91d3118a92c391fe7f",
      "pseudonym": "Victorious-Tape-Max",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb8fe807aa951e35af53fd0fee36abc303864ce76",
      "pseudonym": "Prime-Basis",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbd013386f7a70b5dee398029ebb5f050132fd8cd",
      "pseudonym": "Agile-Anybody",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbfa09746cdac8268a0bbd9a3d9da0ad0e0491a65",
      "pseudonym": "Portly-Authority",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbfba1136a9484c7eb8cd9bc6e08a3fa244b59774",
      "pseudonym": "Mundane-Generosity",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc5187cb669690150643ba2f9aac6b7d98d212594",
      "pseudonym": "Spirited-Priest",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc6700fb379d24f4166f50cb2608dc26a01b9556c",
      "pseudonym": "Jumbo-Accessory-Bestseller",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcca96722a7a98c764b10be70f9711890701eaf95",
      "pseudonym": "Limited-Yacht",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xccc414a0db8e757c97bd628415553fac4f0e4193",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xce0b1054a2adb61a3efe8bcd42acc8d40154b974",
      "pseudonym": "Bubbly-Cope",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcf8b32e3337f0007a51f4f35ee4b265fc1684ded",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcff4d7c6c3fa4c1c72158798562884390f36cab0",
      "pseudonym": "Jittery-Sunrise",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd06103558364d75df0014690f5daa347e49ed76d",
      "pseudonym": "Slimy-Ruler-Spectrum",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd0e696b340b42a7d8251ec7c49911e6ee0bda6ed",
      "pseudonym": "Evil-Spelt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd0fd06e59d5c20c10c5f26ef0762c79f854f0ff3",
      "pseudonym": "Witty-Fender",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd218e474776403a330142299f7796e8ba32eb5c9",
      "pseudonym": "Attentive-Crewman",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd5ef4a8cbb823390f0aeb3abebce94b88cb98b8e",
      "pseudonym": "Flawless-Pimple",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xdc5bb8ac24bcd21c782b0516d14bf239506be97f",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xdcff05be2ac3ee70a6d35a269e51faf46633eb22",
      "pseudonym": "Stunning-Tassel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe3dc344f436beda8992c73603143eceff48b36e8",
      "pseudonym": "Welcome-Haircut-Wren",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe50e7c80d4949938f2ba4e811ad1482e885f45c5",
      "pseudonym": "Outlandish-Official",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe7123a5454f9be0a197d5909d2720a4d473c9a10",
      "pseudonym": "Shy-Weird",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe977b6270e1d6740117b4a56cc7595e4c9e4700f",
      "pseudonym": "False-Teammate",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xebb1573b8bec894b06e0db3e5586563d908de7af",
      "pseudonym": "Illustrious-Yard",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xed2930d2be9d3d992cbd0acd6d0efca25d533024",
      "pseudonym": "Chilly-Brain",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xef08ae4739e964a646d493da4aa1defbde73ca98",
      "pseudonym": "Ready-Reorganisation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf017347373f239973525616ebe3d39ad79684f1f",
      "pseudonym": "Positive-Wrong",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf2950cf5fbbfcdaaf73268f2967c37b97a36667a",
      "pseudonym": "Delirious-Hatbox",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfb5c08039ac3fde6bcc946bc1ac9823ab80ecda7",
      "pseudonym": "Overcooked-Function",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xff39c4be49d99acc5b80aea107d0b378343fb904",
      "pseudonym": "Embarrassed-Killer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 28,
      "wilsonLower": 0,
      "eligible": false
    }
  ]
};

export default TRADER_REACTION_LEADERBOARD;
