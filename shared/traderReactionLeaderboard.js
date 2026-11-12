/**
 * shared/traderReactionLeaderboard.js — GENERATED FILE, do not edit by hand.
 *
 * Source: scripts/analyze-trader-reactions.mjs (live Gamma + AviationWeather METAR
 * + Data API v2 trades/prices-history). No users are fabricated: every row is a
 * real proxy wallet observed trading a target bracket around a METAR warming node.
 *
 * generatedAt: 2026-11-12T12:31:16.079Z
 * events: 17 analysed / 21 selected
 * warming nodes: 78 found, 16 qualified (baseline + reprice)
 * users: 981 wallets with >=1 qualified observation; eligible: 0
 * definition: ahead = direction-correct trade (BUY YES or SELL NO target) inside
 * node ±300s and strictly before the first >= max(0.05, 1 tick) target reprice;
 * qualified (per wallet) = number of qualified nodes where the wallet traded the
 * target at all (shown as `involved`); reactionRate denominator = all qualified nodes.
 */

export const TRADER_REACTION_LEADERBOARD = {
  "generatedAt": "2026-11-12T12:31:16.079Z",
  "qualifiedWarmingNodes": 16,
  "users": [
    {
      "wallet": "0x0172d9aea5b523c33955c0e9841d9a6af82d4e84",
      "pseudonym": "Back-Nod-Wiseguy",
      "reactionRate": 0.625,
      "per100": 62.5,
      "ahead": 10,
      "qualified": 16,
      "wilsonLower": 0.386406,
      "eligible": false
    },
    {
      "wallet": "0xce0b1054a2adb61a3efe8bcd42acc8d40154b974",
      "pseudonym": "Bubbly-Cope",
      "reactionRate": 0.625,
      "per100": 62.5,
      "ahead": 10,
      "qualified": 16,
      "wilsonLower": 0.386406,
      "eligible": false
    },
    {
      "wallet": "0x758dac51ba3cc9a246a79787da9df11c5f425d9e",
      "pseudonym": "These-Latency-Perspective",
      "reactionRate": 0.5625,
      "per100": 56.25,
      "ahead": 9,
      "qualified": 16,
      "wilsonLower": 0.331782,
      "eligible": false
    },
    {
      "wallet": "0x9efda3d6354152901fc4706c3b1a9ce50b45ad00",
      "pseudonym": "Decisive-Ephyra",
      "reactionRate": 0.5625,
      "per100": 56.25,
      "ahead": 9,
      "qualified": 16,
      "wilsonLower": 0.331782,
      "eligible": false
    },
    {
      "wallet": "0x1f0754eb8b460dc7df947014b617e51015717573",
      "pseudonym": "Thoughtful-Legitimacy-Government",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0x486c8e5df09352620636b38e849ac10272126799",
      "pseudonym": "Deafening-Cyclamen-Sick",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0x69f0c154a3412f2b3fa7eb22c6d08e6b5b32fb27",
      "pseudonym": "Spotless-Investigator-Overcoat",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0x7d640ebd20cf136bee351100438bba44ca2e07f8",
      "pseudonym": "Irritating-Overweight",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0x971199f0a99275218454d86377ff1044cdf38ee7",
      "pseudonym": "Each-Rhetoric-Forgery",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0xa996e39ebe817379c363bc59a33a61b1ed6667f1",
      "pseudonym": "Notable-Archaeologist-Placement",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0xe102b1da4367d827b48c47ea91fadf6997ff71df",
      "pseudonym": "Remarkable-Underpass",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0xe28db285fa8acdf73eb9d184627a1924bc7d9c81",
      "pseudonym": "Huge-Airfield-Conspiracy",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0xff39c4be49d99acc5b80aea107d0b378343fb904",
      "pseudonym": "Embarrassed-Killer",
      "reactionRate": 0.5,
      "per100": 50,
      "ahead": 8,
      "qualified": 16,
      "wilsonLower": 0.279992,
      "eligible": false
    },
    {
      "wallet": "0x005ed998fcb786679eb8bfd0d20c15c0903d6d8e",
      "pseudonym": "Pricey-Million",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x33c8f2e65c1ffc09a7af6ad0bfc6987a4db1de24",
      "pseudonym": "Well-Lit-Dose-Raisin",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x3cef8ac05aae4e20af5347c8dc93246e9cf623e0",
      "pseudonym": "",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x6891589732cf8beaaf424b117d5c5c20919f6bb9",
      "pseudonym": "Charming-Kidney-Imagination",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x6a8d1709bfb718d8555d315a983c4816278350f9",
      "pseudonym": "Teeming-Biplane",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x6c1cc207c5013c14ea1a2c721831f4ba8eab1ac2",
      "pseudonym": "Unhealthy-Drive-Offset",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x72da12d9e58123844505c82448a172018386a89e",
      "pseudonym": "Squiggly-Toot-Venue",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x9c237ad435792d8d435bb7df9105330640597c89",
      "pseudonym": "Gregarious-Degradation",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0xa63ec2275675900082115afcff5d565caee0c0d6",
      "pseudonym": "Worrisome-Duck-Razor",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0xb3d748ab8e5f2df6a88aa8881fea405a5e7f6630",
      "pseudonym": "Determined-Rediscovery-Sabre",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0xbfba1136a9484c7eb8cd9bc6e08a3fa244b59774",
      "pseudonym": "Mundane-Generosity",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0xcc37ea305c30110a0feeb94704f2c7e2179bafb6",
      "pseudonym": "Pushy-Cake-Leading",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0xd7b699d42ca107b8272067d08a396856c6e22ccd",
      "pseudonym": "These-Woodshed",
      "reactionRate": 0.4375,
      "per100": 43.75,
      "ahead": 7,
      "qualified": 16,
      "wilsonLower": 0.230984,
      "eligible": false
    },
    {
      "wallet": "0x014a7d737f15534da52df714b95863bc429e4f20",
      "pseudonym": "Bleak-Laparoscope",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x16c7337106a0b3a06ff863a1c06d8e2cbf7322cd",
      "pseudonym": "Colossal-Bookcase-Saloon",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x4addc66860b349959cb5070a83dbd9eeb6836fe5",
      "pseudonym": "",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x4e72c22cd76f9973a48aedfd79feeaacc8b7ffb9",
      "pseudonym": "Shallow-Diadem",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x65e6f32a21c333f81c5292ea7235d96c63803289",
      "pseudonym": "Faraway-Tabby",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x65f7226a82e093e5115e47ec2f4f7e733cd28b98",
      "pseudonym": "",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x7eeb94f2d5a474123e260f160b4f15d3f3eab6bd",
      "pseudonym": "Prize-Standing",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x9be5b190a4f452138a1f804813fe81293c7f6c75",
      "pseudonym": "Yellowish-Bin",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0xac1fea161a2c092cb197d68a2d56757166d5cf6a",
      "pseudonym": "Sturdy-Diffuse",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0xb40e89677d59665d5188541ad860450a6e2a7cc9",
      "pseudonym": "Entire-Hood",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0xd9fe6f0f41ca99fefa93c55d8890000e5a84db0d",
      "pseudonym": "Prestigious-Zephyr-Jail",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0xecfffc9a5561ca7588740d47d7da43ea473b5645",
      "pseudonym": "Dim-Grandmother-Perfume",
      "reactionRate": 0.375,
      "per100": 37.5,
      "ahead": 6,
      "qualified": 16,
      "wilsonLower": 0.18481,
      "eligible": false
    },
    {
      "wallet": "0x03a43e77adeafc3346ef1be0cca68b53101d92ea",
      "pseudonym": "",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x0a16c6d4ae468403b54efd9c274756e2be4e6004",
      "pseudonym": "Unlawful-Bone",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x1076773fc4639a7ad88bcfa5dbfee1dd3aa7c0aa",
      "pseudonym": "Neglected-Sausage-Tomography",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x1ffaaec2600c2a3957779304f404f390d365cd11",
      "pseudonym": "Arid-Nurse",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x298ead7a6126afeef03f184fdc394c77ac01ea06",
      "pseudonym": "Positive-Gasoline-Ophthalmologist",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x496f76bd5cf4c2819c710ae90ed1c84b2dc6fa5d",
      "pseudonym": "Bland-Dynamite",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x5a1a32ec6c0b2896a4e9e3d7a48098ec88e92983",
      "pseudonym": "Political-Nasal",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x6b4a44b74395e17ca54a133f01560428d93f3647",
      "pseudonym": "Worthless-Omega",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x7076cb961e87bd22199445d02fe22973510cd0d9",
      "pseudonym": "Gorgeous-Criminal",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x716aedf1ee92327519a578aa36bcace508c4e885",
      "pseudonym": "Coordinated-Sector",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x8d6004b697233bf4eb3b82f22b281d9c0209a7a5",
      "pseudonym": "Naive-Text",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x9b129ad05bc0a8df3c73dfcc66fe75252daec2d5",
      "pseudonym": "Hasty-Worker",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0xca8432ac8200fb981ea89da18659e3184faf6f8d",
      "pseudonym": "Inborn-Epoch-Anorak",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0xcd154f053a291f46e550d5fbcd4cfa7ddbc4b352",
      "pseudonym": "Self-Assured-Laparoscope",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0xeb68675c06e0bb9f08ba510550912d77289ce362",
      "pseudonym": "Limping-Baggie-Technique",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0xf115ce9c8fb1c8d9f0178b87b388ec0b15230c0b",
      "pseudonym": "Unwritten-Contingency",
      "reactionRate": 0.3125,
      "per100": 31.25,
      "ahead": 5,
      "qualified": 16,
      "wilsonLower": 0.141644,
      "eligible": false
    },
    {
      "wallet": "0x0a0c42f6b1da5a633ec1a4d45ba76eb486c1a853",
      "pseudonym": "Witty-Disregard",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x122cb94c437ea5e6f088c6c0c143c592ab8efbed",
      "pseudonym": "Careful-Bunch",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x19f82d6b678acbb1c9d4b8958a068c03f63ecc1c",
      "pseudonym": "",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x266fc3ee8fc646ff9606b0569e5533c4d7d1c608",
      "pseudonym": "Bewitched-Greatgrandmother-Service",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x2ebbcf7d965c2e700fa715f737ac6b93f23435d7",
      "pseudonym": "Sarcastic-Garb",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x39bb52510caba266761b3e6ef3c27934595c13d7",
      "pseudonym": "Greedy-Camel",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x53b933bec5f65d5363ee1041050d265517964b3d",
      "pseudonym": "Minor-Television",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x59f5c1b8fce2199a3da11d1418cc38feda184276",
      "pseudonym": "Scary-Grouper-Pain",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x5a218c7ad04135830a45c41aaed7294df7809318",
      "pseudonym": "Sparse-Cookie",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x5aad6df1c0c544ec30b351922ef9871e1dcadc28",
      "pseudonym": "Favorable-Macaroon",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x5cf37ddc5ab0758df78ad1fc9146c04c8475fc86",
      "pseudonym": "Ancient-Organ",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x671558412687de6dac0558f320ba9f9599c89365",
      "pseudonym": "Stimulating-Steam",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x6fb4f8499ff65b725e8f9455ff58b9829aef76e9",
      "pseudonym": "Dear-Marsh-First",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x8ed6ae93fd7c966cf001bb0586417fbcc09487d4",
      "pseudonym": "Traumatic-Addition-Iridescence",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x937bcac3a8a30c07d827ad0550c3fe3a6756bfab",
      "pseudonym": "Abandoned-Pipe",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x966c31fb10f9fa46ae97ef8b0dc01c188c39087f",
      "pseudonym": "",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x9892ef52593bf4407e1ffcea509516bafa53fd59",
      "pseudonym": "Chilly-Harpsichord",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x9d0d070d75b63969b17eb592305953defdc0807d",
      "pseudonym": "Yearly-Wifi-Tactile",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xa0161e41c059c3c6662d96f7f07226dbfb6067c2",
      "pseudonym": "Puny-Sandpaper-Dromedary",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xb2e42d29690b7b63335a03c0fd5e64df0681b7f1",
      "pseudonym": "Exciting-Hat-Vegetarian",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xb7bf495534953090f443a9eb91a8653b1078f128",
      "pseudonym": "Spanish-Millstone-Bride",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xba168a94fa230f0fdee8d2b903a11343631b3289",
      "pseudonym": "Another-Duckling",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xbf13934a1fec7d3211fc15c138d84ac2a691b91a",
      "pseudonym": "Boiling-Miscommunication",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xcaf59289145789242a4af6b975997344229841ab",
      "pseudonym": "Alarming-Leg",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xd71776a8d4fddeb3c150c4607b3f8bec31213b85",
      "pseudonym": "Radiant-Nonbeliever",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xdd63bc7de9b4c18a53c88a652685cc4c3104c822",
      "pseudonym": "Elegant-Intellect-Lacquerware",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0xe9e8ec08c9f942d8f2dc169f9620c17cf08c02cc",
      "pseudonym": "Vicious-Congo",
      "reactionRate": 0.25,
      "per100": 25,
      "ahead": 4,
      "qualified": 16,
      "wilsonLower": 0.101819,
      "eligible": false
    },
    {
      "wallet": "0x00650ea57637796aa9705a5e0a32967dfe1c6df4",
      "pseudonym": "Uneven-Independent-Ball",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x044054548049928d9f2b06a77bb3461ab06d2dae",
      "pseudonym": "Distant-Cook",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x044f334595a7fd42c143e11c8ec47f23c8d1d1f1",
      "pseudonym": "Lovable-Hutch",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x0966bca66e754450b10ee105b68af25bebef514b",
      "pseudonym": "Knobby-Crayfish",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x0b886a8a9a8f3d121dfb735c905b4c20daf163df",
      "pseudonym": "",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x0beebc85bcbf8be9383f27656a208e096ea259ac",
      "pseudonym": "Silver-Horizon",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x0d34d6b2407d32acd7c81c2376fadee10ff5cd67",
      "pseudonym": "Rude-Algorithm",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x0e27f1ba27be9ec31a304bdaad555d8782744e34",
      "pseudonym": "Awkward-Rate-Remote",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x15e9a4f23c85ce0d5b2016cd029d9185e9b3dacd",
      "pseudonym": "Competent-Detail",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x165915c6df220109589b90b0b5d5cd81420542f8",
      "pseudonym": "Warped-Circuit",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x16f01030a76c2b671047485e5b52f61a46372bad",
      "pseudonym": "Wide-Glasses-Testing",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x194320cfd8a2f19a6591c1e401ed27d370494440",
      "pseudonym": "Frank-Thinking-Amendment",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x1abc2b469b5ded495d6c8b21fc79dcb8d8f345e7",
      "pseudonym": "Pure-Eyeliner",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x1f85eb9c455c5bdef5d96c2739076678c7157b02",
      "pseudonym": "Comfortable-Sandwich",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x21ec2ba8b15f85f569e1c4d7c5b9bacae65d00be",
      "pseudonym": "Dapper-Dromedary-Obedience",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x21f688f876a76e7bda1c6dce24806b903043af55",
      "pseudonym": "Familiar-Textbook",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x26cb4ff347e75f0f9e5b9b699e9d727006b23e56",
      "pseudonym": "Broken-Opposite",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x2bfd3738d0298174dfa80a1202f8156fa739c4cd",
      "pseudonym": "Blue-Hug",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x2d2d2b32e5199edf833594a99b9c54e5668ab69d",
      "pseudonym": "Forthright-Geyser",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x2d88999526d88c045404f185bc1ecbca91c36ade",
      "pseudonym": "Dry-Junk",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x2e3def9794d951b6249a8460901630ecc3c16aa1",
      "pseudonym": "Evergreen-Frequency",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x342c086bf1a800b568f2bf24130d39057220de11",
      "pseudonym": "Harmful-Specification",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x3653235d75a0d5969c42f7514d4df8ea5f8cef74",
      "pseudonym": "Knowing-Arthur-Ash",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x3f302dbb8e2cef9c25ea1cf8980b97711234f8de",
      "pseudonym": "Shrill-Netsuke",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x49b2ad2275b62c79ddc653fd4eaf2f88173fa6da",
      "pseudonym": "Giddy-Inquiry",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x4c9affa3a4f5ba6b9ab3dd272c20e47ea47e0cd4",
      "pseudonym": "Plastic-Duck",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x520f65a2cb8ddaeabd21f3965350915ffc222d92",
      "pseudonym": "Forceful-Style",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x52cf8883a337b0504db8b41d7d0e3a6d229f585c",
      "pseudonym": "Royal-Southeast",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x549c191f5d722d47456c763b9c35edd9fcde100a",
      "pseudonym": "Monumental-Ego",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x58ce71b1d54b7a4b61e16dd4981b25cd44417be2",
      "pseudonym": "",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x5a1ee055356e6750647acead0e03bd0c3833fa69",
      "pseudonym": "Zesty-Restroom-Overshoot",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x5bae7577f470244ce8e678d20693eee2b8ffed25",
      "pseudonym": "Beloved-Pathway-Administration",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x5d5eae420828ccd9837e24d8bc98f3f38784c32a",
      "pseudonym": "Hefty-Cloak",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x660c8aa54920cb6beb83479d39af563dfd987f7a",
      "pseudonym": "Determined-Prow",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x6beefb1c8d4b91b9b6d437840c241e74e6997e78",
      "pseudonym": "Elderly-Reveal",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x77caa053b2b6516f07ba535308815153fe6fe273",
      "pseudonym": "Shy-Apple-Work",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x77d65d6235102dfc241b59dfd32d6125ff4d1d8c",
      "pseudonym": "",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x81035115a389a085e36255e5cb9b9ab8ee3723a1",
      "pseudonym": "Limping-Shape",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x87650b9f63563f7c456d9bbcceee5f9faf06ed81",
      "pseudonym": "Straight-Wrinkle",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x90a4fa2fc834d4358ec43eba038492e3e02d6eac",
      "pseudonym": "Key-Allergist",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x93dd5294fbf8c35190c4616ecc63d9cf88e34ed5",
      "pseudonym": "Merry-Stump-Loft",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x9ea2f9a4ac4d4ce350db2f997a7d79e23d0d665a",
      "pseudonym": "Extraneous-Surprise",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xa26f65f33dcac856c0916bca49f9c03464e8e9bf",
      "pseudonym": "Joint-Wage",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xa3a76757332db1030962fa94afb1f6ca453ddfb2",
      "pseudonym": "Vain-Scissors",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xaa930fdc4caa3c0f6067404a7bd7899ca45f0bc7",
      "pseudonym": "Bowed-Jam",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xac7ab4cc2d0a83f621ed89f63c722e76fbe104ff",
      "pseudonym": "Vicious-Chalet-Celebrity",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xace0a40e94a4d58d6c9381c316e40f38e4bd9c90",
      "pseudonym": "Ugly-Element-Path",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xb22682e5efaaa5ae3f48c3b727cf78ae57c04163",
      "pseudonym": "Fussy-Skylight",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xb87fb360cb36b252a237b11b18d9a4127ee3f7d4",
      "pseudonym": "Kindhearted-Steel",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xb8a2cab7f099d5d6f2fc008bc5f39e207fead930",
      "pseudonym": "Shameless-Constant",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xb9f43e2b735ccea2a60cba54ddf8850b163292ae",
      "pseudonym": "Simplistic-Chem",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xbc3c7806dbbc3265cf3bc79b024386171fb50777",
      "pseudonym": "Unwelcome-Plaintiff-Photograph",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xc156550a781e9740e580cd418bb52be5c2c4f2d1",
      "pseudonym": "Well-Groomed-Hexagon-Eyelids",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xc6693a8427c94af8e4f50daeba242a8db0d9a872",
      "pseudonym": "Willing-Battleship",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xdd0dc770747edce2a4d08b9d1aebd178742ecf39",
      "pseudonym": "Nutty-Hood-Treasure",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xe3dc344f436beda8992c73603143eceff48b36e8",
      "pseudonym": "Welcome-Haircut-Wren",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xe3eb836b52c0dcbe23dc81d81d212aa79dda69e8",
      "pseudonym": "Previous-Marshmallow-Offer",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xe419ed7a60b7cd0faac6bd55c59084f3b81e8aed",
      "pseudonym": "Wet-Framework",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xe9076a87c5ed90ef16e6fe6529c943baeca0cff6",
      "pseudonym": "All-Peasant-Drug",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0xf43e378783a2d01fb51f836db8b9bc65725a4a4e",
      "pseudonym": "",
      "reactionRate": 0.1875,
      "per100": 18.75,
      "ahead": 3,
      "qualified": 16,
      "wilsonLower": 0.065915,
      "eligible": false
    },
    {
      "wallet": "0x02e564adb4c1647520fa398f1bc432e2d2dd98aa",
      "pseudonym": "Fabulous-Institute-Algorithm",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x056f40cd091d7643e5a2cdbea2c0d242322136fa",
      "pseudonym": "Double-Pliers-Page",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x07b81b74d91addee3e9aae48beb2f74b8b9bb587",
      "pseudonym": "Fitting-Apparel-Poison",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x0845814ddcf1d0361cc3f6d9263b28ad3ff1db5f",
      "pseudonym": "Dependable-Due",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x098262acfe8672a717aaaf522608b5d1871224e3",
      "pseudonym": "Muted-Ocean",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x0a3a7d0d65063a10652e5fa670e37a0bbb4be990",
      "pseudonym": "Dependable-Period-Majority",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x0bd400947db20cc61f82af5ee98f6e5eecbaf2fe",
      "pseudonym": "Jaunty-Gate-Gastronomy",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x0c094e0404a7741b97d4578e41203bb2cfc028e6",
      "pseudonym": "Foolish-Squash-Meatball",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x0d1048ec2a35bb690b217181bf5859d772b9a713",
      "pseudonym": "Generous-Muffin",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x0dba96b5b00c24e2609f88b1cdfb6b6f7d9a623f",
      "pseudonym": "Ripe-Dearest-Disk",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x0e6be957dc8f4ff72d26ca6d1e750fece6013a4c",
      "pseudonym": "Young-Saw-Wildlife",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x104dcddf8a7353afca1daa4b0da2b4c0bf605abb",
      "pseudonym": "Noted-Validate-Drink",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x10968af4773b31a1d97e1a4f072376de12cfa162",
      "pseudonym": "Rosy-Planula",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x110695cfe26bc76bfceb641674228c797c7604d9",
      "pseudonym": "Spotless-Daybed",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x124578a083059d71c4316842580ecdcb92684635",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x145cc027070b4916e5b316d45ccdedbbad62ef01",
      "pseudonym": "Wee-Human-Servant",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x14adccff0397f7ecf2776739f9b7d0ccd85669f5",
      "pseudonym": "Natural-Terminal",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x14bb09522efa359d672f86fb5fc821ee6fab271d",
      "pseudonym": "Occasional-Scorn-Seed",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x1ca4bfd8f0a1d2f27ce4fdd0f385b217101d6aa2",
      "pseudonym": "Complicated-Proctor",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x1d5b28e5783c8e733115f54ce5554c5552d5797b",
      "pseudonym": "Shocking-Parsley-Radiosonde",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x1d5e0de9cef9c2df5b24ae3ca7828a749cbe64dd",
      "pseudonym": "Loving-Inglenook",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x2337c02337374860b1859ea417b379db7e3c697e",
      "pseudonym": "Unlucky-Core-Criterion",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x23385042f967a476e6612fadc19da73c6c58a7f7",
      "pseudonym": "Ill-Put-Spice",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x23fc1a25d03f187a71d3eeec7cd86d8fed3189f2",
      "pseudonym": "Grubby-Meeting",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x27066a9484c2a7ad5a0c6f85cdc778234985c6be",
      "pseudonym": "Near-Science",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x28970832a7981f001028548b6416062df13d31ad",
      "pseudonym": "Precious-Destroyer-Anterior",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x28b83efedde6f74dd5943c0c2312018642c7f161",
      "pseudonym": "Repentant-Chronicle",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x291c6078a2e62b03ce705c8b72a786a3d3433647",
      "pseudonym": "Faraway-Wisteria",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x29eda18df836ad93a8c285f97873bbe26118a8da",
      "pseudonym": "Apt-Antecedent",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x2a51626913f7a927af07f72bfc500a0953cfade7",
      "pseudonym": "Precious-Tortoise-Sideburns",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x2a532cd41e91fb85f9000b032197590384c45229",
      "pseudonym": "Magnificent-Luxury",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x2dc2db41a4d68e3747d3353f5229150ebb39cd31",
      "pseudonym": "Woeful-Butane-Temple",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x3135a496407140fe26c1fcae1d2814b228d5cc2d",
      "pseudonym": "Feline-Tool",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x3137eff3f4e5c442c535169fa4341b12cf2cb7f6",
      "pseudonym": "Outlying-Gravy-Advance",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x36ffbed6d09ff3b6ed6a6cf1bb90ae7e4e7bf2a6",
      "pseudonym": "Optimistic-Publicity",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x3a3f54c775006ea60c749a0c2264c135313188e2",
      "pseudonym": "Needy-Trade",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x3f8f6cf7ed5117aa10b15f99614989443fa783f9",
      "pseudonym": "Perfumed-Sale-Mezzanine",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x43cb4ae1f4ddc9e671486c79c9f40a6fd98b84df",
      "pseudonym": "Fair-Tan",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x4959175440b8f38229b32f2f036057f6893ea6f5",
      "pseudonym": "Rewarding-Pantologist",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x4fd591cd13d8843e9733ca05659ebef07e6dc897",
      "pseudonym": "Alarming-Wetland",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x500ed64d714b6411f2f9efce96d0972362e77c9a",
      "pseudonym": "Mindless-Pass",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x501c9ecce9236992794cd12e88d22355e6454d6d",
      "pseudonym": "Impeccable-Cycle",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x518467728111bb0a29095900887d167362f41363",
      "pseudonym": "Fortunate-Scratch",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x54d0b4f7500e40491f5765ae65130ef344405ff5",
      "pseudonym": "Edible-Portion",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x56341628a05932e7fa933bbd082411942d678c9b",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x56919ffe4f929a5a2e6867b37d2a518724ad3476",
      "pseudonym": "Steel-Presidency",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x56af101765c11d9e7d220cb416dbdb5d44190483",
      "pseudonym": "Liquid-Hydrant-Prophet",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x5b9b057f8fe2e730817fe88ab0322db83a7ca6ab",
      "pseudonym": "Cuddly-Placode",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x5bcfd34e00df94ac97b5c51b408a436df3380aa2",
      "pseudonym": "Neglected-Impress",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x5d951d73469a5e84063d0d1f74a7a05e57ef6359",
      "pseudonym": "Humongous-Judo-Exaggeration",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x5f3ee9c40be255d1c18ca38bf4ab94b564c75337",
      "pseudonym": "Standard-Jackal",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x5f612351a9e46afbe3f164473a7d77a69ec9840a",
      "pseudonym": "Alarmed-Riser",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x612094fa2acd67d2a38f02a4bb5559ae1a27f1fe",
      "pseudonym": "Neat-Implication",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x6181a221dec6606f10d5ceaafd34f4ad54ea3f20",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x62bc9000734cb7252ef087c2d76cbe07ec112dfc",
      "pseudonym": "Awful-Hatred",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x65d8b07fb2d316d28e8667e571ff895177544595",
      "pseudonym": "Simple-Astronomy",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x6c9afcd07db91455d381e9a66684ff6bc715ea58",
      "pseudonym": "Lost-Tomato-Motorcar",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x7185c852de9355f314f8bc5e14f0d491b16eaa43",
      "pseudonym": "Fine-Hovel-Sample",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x72f7fa6c7bd096cce1855a20a52b8fb444c88c54",
      "pseudonym": "Imperfect-Kale",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x72fec014514bcebf47bef2638eb398adc7d29573",
      "pseudonym": "Radiant-Lawsuit",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x759dd24191e83fd8bfa18ec5138ebb2e914bcc80",
      "pseudonym": "Pure-Behest",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x7b9acdd4c8e0bf2e82f1a41e2f706b1498f97908",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x7e4f7e592b7d8044a0f9fbc91e68279a9b8d3f22",
      "pseudonym": "Gloomy-Skullduggery-Noon",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x7ec15a5dd6223b951f0e106574592d567a0ee2e3",
      "pseudonym": "Corrupt-Substance",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x7f3c427acd78787d28e3ff2efecca1073243eebe",
      "pseudonym": "Personal-Notepad-Bronco",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x814d837c815d65cdc4b6372a0f1860f810cc5bbd",
      "pseudonym": "Concrete-Adverb-Heartthrob",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x83198a8ecda7bfcb69dd8648a8385259b4c2d69b",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x88840b12211f3266e70ddee9b7f1dd298426533f",
      "pseudonym": "Ordinary-Leaf-Physical",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x8b8b9c565c8dca43cfb767f0f2c20b2b323d2512",
      "pseudonym": "Classic-Loggia",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x8d7e120587c3cddcdf8bcd5779007cb78baa087e",
      "pseudonym": "Equatorial-Homogenate",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x8ff0898645920c013ac65e2b2548abf974e6584e",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x9009e9ddff124c51b91a8eb0726dd892d25facb2",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x90f02fc564c76bccc6032fe8f9779dc0ef5ddc7a",
      "pseudonym": "Acceptable-Rhythm",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x923773250dd8ba361497f21fb80ddee2e1137ee9",
      "pseudonym": "Huge-Competition",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x94b7719917005dc378926247f1b4d14bcc6d6b01",
      "pseudonym": "Separate-Patrolling",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x955cf8f5e8b672539ee885e853972842449ba075",
      "pseudonym": "Frozen-Shallows-Bower",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x977ad9e8d79b0bd80c0c9d411bf1ae928cc74b41",
      "pseudonym": "Vapid-Prostanoid",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x9970bd8239bb48a350b0cac3a517e1225e087210",
      "pseudonym": "Kaleidoscopic-Line",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x997ef486d2a5513069bf4aa089e6293e56297e58",
      "pseudonym": "Extraneous-Truth",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x9efbece66cef836e2b90255541e35baf8456de81",
      "pseudonym": "Tremendous-Hugger-Subexpression",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x9f6a4549f14154a7f2c74d03efd8de903a61eb61",
      "pseudonym": "Dramatic-Sunlamp",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x9fdc1b45e7843c27d58898fbc758f8ca400a487a",
      "pseudonym": "Posh-Proximal-Deadline",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xa1a485c6262bfd4cddfbb86af40257c131d27d62",
      "pseudonym": "Tricky-Organ",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xa568d21bc6e9ad11c073c358b8919e07b0d1bd84",
      "pseudonym": "Joyous-Invasion-Mare",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xa794a585f3ec8bbe440372e3c0700eff5de33a01",
      "pseudonym": "Grounded-Cohesion",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xa86b1174d30c23ef4d37c745e93d36c57d3896b8",
      "pseudonym": "Evil-Recession",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xab3eb11c6946b607b0f92cc9e2197edf747218ef",
      "pseudonym": "Musty-Custody",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xab891813faa05e4b190dc7d75305bdd5bf3298e0",
      "pseudonym": "Tough-Conga",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xb6ee2fa595a11abe927646aeb9018d5503a0359b",
      "pseudonym": "Buzzing-Interpretation-Excerpt",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xb7b3ed1c02a77a200b600ac407747be2f3b79573",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xba638022a45db07438bbe572dfd04fe43b36308a",
      "pseudonym": "Brisk-Nephew-Million",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xbd71233ab7a25bc420929cd67476219762f31281",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xbddc2a7690bf600e347d5eb4a9c28f9f24e55d4f",
      "pseudonym": "Equal-Sun",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xc62fc154efd70e3a7991726c4eef6118566c1781",
      "pseudonym": "Dramatic-Chaplain-Orangutan",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xc68707c2939345b233a8b003c8d3a39784edd557",
      "pseudonym": "Recent-Import-Smolt",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xc8d1defb07194e672177acac119dd9ab6e2648db",
      "pseudonym": "Pessimistic-Passage-Pursuit",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xcdac8676b0ecb9533c9aa9873b3473f5519f5db3",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xcfebe1eafd8b0cafcff773442c57a002349ec070",
      "pseudonym": "Frosty-Cummerbund",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xd3942296f38a1a916cb8ea2656cfb0d2c5987e90",
      "pseudonym": "Uncomfortable-Mountain-Dragonfruit",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xd7c32a6e12077a51d8f90d3e2b97f0f5234436dd",
      "pseudonym": "Utilized-Epic-Snorer",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xd96aa9293c34e244734f8b22bbcfde0ae9eed8ce",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xdd704b471041b806b65d04a3b48f5aa953811d06",
      "pseudonym": "",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xe1115513a5aa026a2f4346faeaba0a89d0344e85",
      "pseudonym": "Partial-Respect",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xe5cbc25ca7d09686c0f4a83d82cad96be802bcea",
      "pseudonym": "Joyful-Bachelor-Sort",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xec62d23eff1a957d02293c5475d4b7a52f8d9191",
      "pseudonym": "Starry-Flatboat",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xf03de2c138e871fa5b5cf7f5774b6b671847426f",
      "pseudonym": "Quiet-Wrapper",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xf0cd948e34989159a8373d7acca6e20acae6e05f",
      "pseudonym": "Stale-Shrimp",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xf3d266c89086a6d58d033c1247aae1a2949c6efc",
      "pseudonym": "Gloomy-Antechamber",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xf7c3483e248fa31540767f7f3c323a93be55aeba",
      "pseudonym": "Reasonable-Conversion",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xfcf9b9464bbc837545c25226e1a30c5a5e085fcf",
      "pseudonym": "Deafening-Comics",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xfd6a1db54bf81abee809f0c01e945112cd2ff828",
      "pseudonym": "Sharp-Boysenberry-Value",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0xfda38e49d3edfe772688c6451567b02e02ef981f",
      "pseudonym": "Ambitious-Bed",
      "reactionRate": 0.125,
      "per100": 12.5,
      "ahead": 2,
      "qualified": 16,
      "wilsonLower": 0.034977,
      "eligible": false
    },
    {
      "wallet": "0x00327505da877d5a5e72b5a36b0e5427b72e731a",
      "pseudonym": "Acceptable-Asset",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x007841a9106f1292c379f1e507f858d02a567ea3",
      "pseudonym": "Shy-Serval",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0155bb2eb826fac59c583f677c691b6684d0ce80",
      "pseudonym": "Acclaimed-Clutch",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x01e5596171fd4622a302330e76f80629581d49a3",
      "pseudonym": "Appropriate-Identity-Drop",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x02572f98a412cddb137744765070bbb3860ea60f",
      "pseudonym": "Stupendous-Subconscious-Stepmother",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x026427737c372e84e80e472236477b1a9aa091ac",
      "pseudonym": "Overcooked-Insurgence",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x04d1fa86d2da84fe9eca9f3d80a03422e63f7485",
      "pseudonym": "Mediocre-Minor",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x060c3df5c1fac83e342fbc5b4bb34e88c6bf9352",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x07376ac1d083f5ff73ab7a3f1160d045382a5b91",
      "pseudonym": "Puny-Father-Highlight",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0a59a7f2a870392a5f555aaa11f49d612e748e5c",
      "pseudonym": "Wobbly-Expertise",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0a6c7df1bdbcadfa85ba16f10c1ad28b2d1eb1a3",
      "pseudonym": "General-Gift-Fatherinlaw",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0ab7c13da505cdcd75a0aa0e9c884ae7161f0bd3",
      "pseudonym": "Deep-Comma",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0ac73c23d2d19d9bf6dc581e7529947ccf0bdd80",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0be07ac912dbd6a770c68b88536dc917900051ca",
      "pseudonym": "Deficient-Heating",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0c28d976bbfaad597a678f6fc3794d6ba56a9844",
      "pseudonym": "Required-Horn",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0d4e6db0559fe5483c3831bdef8f8b5136f380b3",
      "pseudonym": "Frightening-Legislature-Bulb",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0e0e8174e213ff2c2ccb30c5652a7b7d77c72d75",
      "pseudonym": "Queasy-Divan",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0e7ad63959ee506b04316a32b3e7f16e021cf642",
      "pseudonym": "Junior-Parable-Woolens",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x0fc1530f7999d9038a7902ace77fa4101bb8a3bb",
      "pseudonym": "Colorless-Sport-Implication",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x100a75497f8f21585b6dc3395845d41fef330919",
      "pseudonym": "Thin-Interject",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1024a5c35f991da38ef826b6307ea5cda7b3831a",
      "pseudonym": "Superb-Mascara",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x108f6a24ad0d381b6a0b9ea0244dad85866fee30",
      "pseudonym": "Quarterly-Hearth",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x10c5e39aa75b05754e89722119486b5a2af33cb6",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x13aeb9d94fb10f23feb5efce78ae0d03ce8236e8",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x13fb3627425afd07a73f8dc0e44287f759d9e4ce",
      "pseudonym": "Dimpled-Peen",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1417b6fd7444b2f1091b5c8357cf89ecafb238af",
      "pseudonym": "Violet-Thought",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x14c7ab0cd322b66c9e433793bafaec77eb60485a",
      "pseudonym": "Modern-Anarchist",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x14e296e208258247e8631c4749ce273d5342282f",
      "pseudonym": "Digital-Archaeologist",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x164cb85e1718d0a8f95d588b08fbb52b34233e39",
      "pseudonym": "Essential-Shell",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x175cd3fa3cea9b475229552e91fa84a9b5d3e90b",
      "pseudonym": "Worn-Tunnel",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x19199f5540d11a72998c501c5827ea81c3a5ce00",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x19bbf4fddca1a201bc9a657ca84dea7a455158d5",
      "pseudonym": "Knowing-Freon-Linguistics",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1a925076b74d2d6134ace8fa1219b248da1635bc",
      "pseudonym": "Coordinated-Craftsman",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1b94aa088a11fde2246c39f9a1e64d1f2145d2db",
      "pseudonym": "Wry-Bulk",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1ba75514fa9dcd48d5eea3a2ae7c1fb990353d88",
      "pseudonym": "Normal-Leeway",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1c3765cb169fb480117cb5e5954138e46f61a324",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1e221558e779e022a9960cca8c6845fd8fd167b6",
      "pseudonym": "Stylish-Cohort",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1f3bf7a486a3cfb944690e3375bb2771e7969ed5",
      "pseudonym": "Pricey-Riddle",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x1fbc165ba105bcf5dab6ff96819c036daa9e4105",
      "pseudonym": "Kind-Flour",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x22792f188dc1b986b1b2b28d7524592b578ab2b5",
      "pseudonym": "Cruel-Scenery",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x23498989115b4c0ffcec95f57aeea6aa28211646",
      "pseudonym": "Valid-Deputy",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x256fc31d9281f6914b1159e896f73c2ec3377833",
      "pseudonym": "Cultured-Clothing-Curry",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x26732f2d7707fe35713f2265e83e0fd82ecbdec3",
      "pseudonym": "Awesome-Curiosity",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x26f89d1e9ead687db7387d5274db85191d353770",
      "pseudonym": "Young-Poppy",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x271e08a3d78febfbe0c8bb2e7a8e0ef440118eb9",
      "pseudonym": "Tall-Teapot",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x27d74640ae304d299669c9389e72664e0e6addc7",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x286882251a071ba20cfbfe4b128eb55bcad597f8",
      "pseudonym": "Worthless-Biopsy-Monkey",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x28bcb32f3e3fa53e25ad3a92ab96642d729fc1b8",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x294b241f8b97845803fe34a9b99629e07cd422d2",
      "pseudonym": "Grave-Peony-Label",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2a5f357f423df18ad6819db3d09645c9dbe51a13",
      "pseudonym": "Circular-Bud",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2a672b88cc718617412fada0c92d5317d9505d96",
      "pseudonym": "Radiant-Jackfruit",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2b96144d2cbacabbe5ffadb9e17060a0bb911898",
      "pseudonym": "Unlawful-Shakedown-Coffin",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2df9a004af27665aabe6a506288a5187619c4534",
      "pseudonym": "Unsteady-Apple",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2e164514058e7d78ac5f5a38de41619c187d27c0",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2e3ecedec4b004c61670f0dcda382ec0da1f0f92",
      "pseudonym": "Hollow-Apse-Peanut",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2ef2f13f30e523197e9e66afa2f2620f02fbfaa5",
      "pseudonym": "Academic-Hubris",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x2f4190783e0de73e20c976fdd4ffa4905285c31e",
      "pseudonym": "Valid-Sill",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x300a8e01782c4c28794cf24a663d5eb443456501",
      "pseudonym": "Aged-File",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x30236b29df89a7f203c027f58f62450f5b0b465c",
      "pseudonym": "Cute-Kid",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x31752a0ac1d4dc972ff9c8502601257bf3ae9bb2",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x31897ff3fbb343efd46309ca858a58e2f9ec562d",
      "pseudonym": "Palatable-Toot",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x31a7111832ce43f3e196b96da09691bb099ca883",
      "pseudonym": "Runny-Medal-Zither",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x31d31d0afe738479d59afb53261eb5dea5d2922d",
      "pseudonym": "Colorful-Goodie",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3252129ff9529fef42ca248d89ce7931d251e247",
      "pseudonym": "Itchy-Sleuth",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x325b894cd506056067a7b4744244eb1eed42f1ee",
      "pseudonym": "Prickly-Ore",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x33088ad76aa851a9154017ce9e450bbdbcf7c27e",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3340d23de3275300f88abfd8803b2f9ea15f13c8",
      "pseudonym": "Whirlwind-Cooking",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x358bf4c992767dc606a1d7dff6a3d95dd5a43722",
      "pseudonym": "Friendly-Allergist",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x35bd6fce980d7a7b396346243d8af89fb4c0a351",
      "pseudonym": "Profitable-Slot",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x35fb9ff237ffe318d6e8b2d026dc339134bb8511",
      "pseudonym": "Complex-Ambience",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x35fc2761f60ab64855a2a99ccd134f44d665ac54",
      "pseudonym": "Motionless-Prince",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x36c026bdb95e89aecf53b9641514135a9a4cf9cf",
      "pseudonym": "Taut-Intensity-Mastication",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x36d867ba33131af556865385e8fe522b6536e990",
      "pseudonym": "Defenseless-Craft-Oats",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x38cf9743eb70188664d388d84d4aa4c6f40fd885",
      "pseudonym": "Sticky-Tabernacle-Nursery",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x399e15ba10fb3c621b9d81238cb4215dae342358",
      "pseudonym": "Slight-Package",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x39db8f23c103b1575bdca8957e8e5062bc03d7df",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x39fb644e883aa4f9742e478d4c863e5bea272c0c",
      "pseudonym": "Elderly-Soldier",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3a02262b7c63ebe4052a666d3040def84fbbad43",
      "pseudonym": "Weekly-Automaton",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3a237fa769d8638bb2ec8dc02830be80330ac9e8",
      "pseudonym": "Legal-Leopard",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3a672173ad59d77fab4eda54bc5bd8a7e8fd6095",
      "pseudonym": "Worldly-Glutamate",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3c11b622d3f6d6d0e1a3188d0f46c3baad2d33c9",
      "pseudonym": "Shocking-Clip",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3c1de4456f7a18addc8b28adcb194b2eb061da77",
      "pseudonym": "Spherical-Balaclava",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3de5b3309a7a2c2d54bc67609cd743f52092c157",
      "pseudonym": "Elderly-Grapefruit",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x3f0b450ec6b45633f60c16bbaabed9fdbd1ad571",
      "pseudonym": "United-Dandelion",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x40be599a6e7b50e7aacb593a6427d5fa06a3e067",
      "pseudonym": "Filthy-Tights",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x418a729f10c6170a50e290354dbf6dd0eca364c0",
      "pseudonym": "Nonstop-Race",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x422e9be572de079873d2f499f0a8013574d24411",
      "pseudonym": "Messy-Deployment-Shot",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x42d8816bb24f372c4bc4a65ed414e67f906f7109",
      "pseudonym": "Heavy-Glucose-Overheard",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x432ce25966f246deaf6bbb653b7668be550e07e3",
      "pseudonym": "Unequaled-Milk",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x43fdd1dfe4ab7c49900168ca57155e512d40080c",
      "pseudonym": "Questionable-Colonialism-Island",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x448168f6ae93616a647fba1a31a56b52bfc43b06",
      "pseudonym": "Enlightened-Edible",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x44c99903c2bd52c86372196d157f6910cea5d3b7",
      "pseudonym": "Somber-Training",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x46532d38063a22045404aeead6a9f3c49e75fc2b",
      "pseudonym": "Joyful-Entirety",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x482943e8126e83a63695cebde33a9498ee7497eb",
      "pseudonym": "Excited-Pregnancy",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x48ef33db14a90d732a5799b9acbe4b39208fc476",
      "pseudonym": "Mellow-Leaver-Ambiguity",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x496d65519e0b65ca8981e95c9d2b56d89793a2f2",
      "pseudonym": "Devoted-Eligibility",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x4b7ea37b437509cd1068735666a6577f6f99cc0c",
      "pseudonym": "Radiant-Monocle",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x4ba22a302a933e4e4e3e76ad168db690d3114764",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x4dba6f046ef237505d4417a7ba6c2cb52b5d3de8",
      "pseudonym": "Electric-Gherkin-Ruling",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x50ab40b1de30cf1f7c8b35923e1b95b89c28edf4",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x51c1971b97aa00d6476e5421689c60ba3621a853",
      "pseudonym": "Distinct-Anyone-Heron",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x52380e03eec638cf859e9e2b053ed3fa652c8699",
      "pseudonym": "Scaly-Estimate",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x52ebca459280966f4a56240a05e38df8527067ac",
      "pseudonym": "Past-Disguise",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x537531d7de03ff1f643a00532632d4b32c48e2b9",
      "pseudonym": "Altruistic-Suspenders",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x543d6f73420abda4c2cf2acc0ebb9dae1b90b301",
      "pseudonym": "Frigid-Dessert",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x55332464a4d4fae19956d740dddff103918251ba",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x566dd61ca3afe7b738424013608caa2b926ad21f",
      "pseudonym": "Idolized-Code",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5a83009fa6c4fcf4c0eef638b7f2bfb5dd27497d",
      "pseudonym": "Prudent-Mileage",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5a88ef7972375b77df48c2b4aad991abede9f471",
      "pseudonym": "Extra-Small-Tool",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5aa8396bf0e4ef2eea04d7065354209c3695addb",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5bc39e3d89a37c5d44312102b332497fce59b0ae",
      "pseudonym": "Ideal-Laboratory",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5dbcd205567ebe7fbbcf48e55209add8e16743be",
      "pseudonym": "Interesting-Bore",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5f264c5bfc29429fcc5b9a7f0b546951d9dcabcc",
      "pseudonym": "Glistening-Bondsman",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5f2e619c63b57c1392c00ce1c860acb77cf2e381",
      "pseudonym": "Wonderful-Crusader-Hunter",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x5f7f573300981824c46a26372e98c16055bc759d",
      "pseudonym": "Quixotic-Farming-Annual",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6095e4c6ff00f0ca70c9a8d3a1575955f1a784f0",
      "pseudonym": "Expensive-Courage-Income",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6140c683b1343ae28f8709f39ef916ebd36ebf64",
      "pseudonym": "Occasional-Attenuation",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x61f7388848e3effe8b4f632b5d43f0c7ad09f8de",
      "pseudonym": "Nimble-Pain",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x62365f754d4aa7dc537f997f23bb5dd9a9e36881",
      "pseudonym": "Wet-Event",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x627e3f3e77d2ce655998d131cb7c6ebc45c1fe4a",
      "pseudonym": "Worthy-Darn-Accuracy",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6288e13f5e8fae226c281e6018c8c40872c6fd46",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x63a49ab643a163e205b298ac9a05c1d38beeb5d1",
      "pseudonym": "Heartfelt-Overcoat",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x648fde5a0d60b7d422e5fc4da51df03fe26d4b36",
      "pseudonym": "Free-Element",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x65b7a4c314a4f0498a756526c29b2079fb7df83c",
      "pseudonym": "Questionable-Nutmeg",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x65e47ca19dbe03a20e02e2bbd3493808c59fd28f",
      "pseudonym": "Uniform-Sir-Tiara",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6610e2c03c8d7866731ac10508a4bf7f6045ff9b",
      "pseudonym": "Plush-Refusal",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x67497a5ff7d1cd4861a83a0cbd67d18d4236712f",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6793beed0080bd1dccce8ddb1cd4cf6b2a04ec42",
      "pseudonym": "Handsome-Destroyer-Songbird",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6921d75e495477be290618f66e73d29cb1ebf987",
      "pseudonym": "Extra-Small-Rehospitalisation",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x693f893608a96db2565664f6e696f2a973092ebb",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x69ba110dee4e9248ba7e5a20f57d3303777a7643",
      "pseudonym": "Testy-Sleep-Havoc",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6a3941f30239b87ff31966d9dcdbb914be93cf39",
      "pseudonym": "Golden-Suspect",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6ad1562d61b93304e70c70736974ee98ddfae9ac",
      "pseudonym": "Incomplete-Crunch",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6b10627ff982ac5ac66192869494c14ca89b3f80",
      "pseudonym": "Drab-Consistency",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6b1afe6e18b60b4cfaf6c0e8391fc9928879c7b1",
      "pseudonym": "Secret-Waitress",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6bc5d4869bc65e55eec9a1e46d69f2edeb6e33d3",
      "pseudonym": "Selfish-Disco",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6c2ed86f2e68dbc611fd6ae5e0ef06fc0b3bf420",
      "pseudonym": "Awkward-Defense",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6df09a225ed2e31670a85cbb297a94d9bf878f33",
      "pseudonym": "Jealous-Doctrine-Haircut",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x6e96f91eba78193c3db3fd04310ea317b08e3ce2",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x700f7d3891b4458b091de3ef2a214db5f649ba06",
      "pseudonym": "Favorite-Clef",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x70ad8808b18d7779a08c17ea73a2eab4457166a6",
      "pseudonym": "Traumatic-Dusk-Timeout",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x73283f2729b8c3d7279a8d17a0065b797ea0dbff",
      "pseudonym": "Lively-Cormorant",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x734ebc2a09ff296d07490f55b5fe9d0e18d9edbd",
      "pseudonym": "Rotten-Leptocephalus",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7557dcc217c7fd1064cf2bb1b7cb0e3066b62c04",
      "pseudonym": "Modern-Diesel-Provision",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x75bf0a286785573e59c6db82f7282836dec0870d",
      "pseudonym": "Avaricious-Incense",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x75c5b9dd65077541fd1e09ac8d022e5f8cd7e401",
      "pseudonym": "Flowery-Satellite",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x75db6a5505d7e7f9ad00352ec9e71e2f8ec3844f",
      "pseudonym": "Firm-Accessory-Advocacy",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x76f4765ebc9bdeaeb4af4d27504bff1d4ce782da",
      "pseudonym": "Fantastic-Caution-Bifocals",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x774ddaee409abeefebc924b3c67a0f7dea5c8b08",
      "pseudonym": "Fearless-Share",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7834f38cc8a8eab35ae6636efe28d52a5c99f823",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x78ed8966161ea0a22f0719b9c04391c6ac22ab3a",
      "pseudonym": "Sarcastic-Termite",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x79c278bff60fc5a8e8b04325e29771cc728ce5c1",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7b259edf41df29db6916f9c0fdd672ddc334e4be",
      "pseudonym": "Plump-Implementation",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7bed1b9ed5f24b36fc66fa3bcfb314fdc273bbf5",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7cd655861ca5c29e734292245988f82e6ff3649b",
      "pseudonym": "Unruly-Herb",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7ec6869274ecc18d1fd71c4c06108da8d4bed0f9",
      "pseudonym": "Innocent-Selfesteem-Exhaust",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7f1a86d1a631caa318abd40649215d7df05cf34c",
      "pseudonym": "Twin-Artificer-Ambulance",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7f7dd2cee82e88ffa79ed5b45b869f0617840360",
      "pseudonym": "Advanced-Marionberry-Observatory",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x7ff115c16042a4dfd58db9eb3b64faeb5f9ce002",
      "pseudonym": "Snoopy-Investor",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x803a112b5eb1404eea463b26a2318cfcb3b9219e",
      "pseudonym": "Revolving-Term",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x804a67cb683b4dac9ddbc13d2dea2328bfcca3d9",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8113ad10b6b9dbb3d9e8d2f398410f99f675b59f",
      "pseudonym": "Rundown-Caterpillar-Smolt",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8166f8cf72cbaf16d1763e8bdb4eb04ead59d201",
      "pseudonym": "Quarrelsome-Root",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x82dfc3b46c414a5de1c8d9b2598f8f0a3c680f66",
      "pseudonym": "Stormy-Landform",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x831d8fb6ea69b27959bfb9d444cfe7baea273893",
      "pseudonym": "Bubbly-Vegetarianism",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x853c83cfd046a7de3d2f6cb85b931e56111cc32c",
      "pseudonym": "Buttery-Middle-Appellation",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x859c09ad24cb3c072c5427579e1da0cb8e1a6eaf",
      "pseudonym": "Elementary-Cleat",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x85edee0a2d08410aec20edffc826f628ff11a122",
      "pseudonym": "Productive-Ground",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x85ff1deb08862f7c98ee1ee24885aed2922c0d46",
      "pseudonym": "Active-Stem",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8614d67d229cf2cc982b31726bb8633bbe06bb9d",
      "pseudonym": "Hollow-Subroutine",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x86b64c3b8bf836f10393b5d4af990a2b6843a127",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x86f65f6a65fd457697ccc546e5956fb61dac7098",
      "pseudonym": "Yawning-Plan-Matter",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x874d9473aefc51bd153eb7eb5cd0a1d8ed467fd8",
      "pseudonym": "Fancy-Maelstrom",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x879d999541ea4b50b7c237092cfc2b5f8a1fb501",
      "pseudonym": "Big-Hearted-Prescription",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x880cf968656f7b31fe8a3aa572a528e16697dace",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8949b3504749a1e7fa4f5d4433d1252544e097e4",
      "pseudonym": "Wild-Cacao",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8b40b67af7fdfe3dc20219b353716ba86dea6a7b",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8bd872ec2819336df7c7ae2c10fb30bf1ac79927",
      "pseudonym": "Delightful-Sideboard",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8eeb8852c58781861d405064fbd0291b481d52c8",
      "pseudonym": "Sturdy-Kiwi",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x8ef4c7cb5cd80c10a1a5269b4666769c81797967",
      "pseudonym": "Intentional-Embossing",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x92dd29962c198b0b7678afe124150f4c0872cac0",
      "pseudonym": "Fair-Septicaemia",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9322893123e8f13988ca94d17ea6258671970727",
      "pseudonym": "True-Shoes",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x93a0f231e22b639c1ece252afc46a98ccd196623",
      "pseudonym": "Corrupt-Skunk",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x940055a6e7fac07d58d38fd66e7dcf28deaac740",
      "pseudonym": "Proud-Tavern",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9411beaca55d98e92cb58774ac54f9a4397f8893",
      "pseudonym": "Shy-Wampum-Bitter",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x94356e158e5a9393fc194ead3271ff73c54f91fd",
      "pseudonym": "Delicious-Puppy-Consequence",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9447376836b753179e4715694ac8dbc6f50748d6",
      "pseudonym": "Entire-Revival",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x94e595f151e6b7973dad4fdf927e1ff9b9ac52be",
      "pseudonym": "Useful-Carbohydrate",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x96548bc0baa8721e6a02846b5279eef15f78fa6c",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x969aee813ccc120fbf7b0817c2726146aa187850",
      "pseudonym": "Evergreen-Ladder",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9765fcda620eaba1d256f71c057a5804e3bf678f",
      "pseudonym": "Fussy-Thunderstorm",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x97c30d4e16522df48321bd439667f3167b87d8f0",
      "pseudonym": "Misty-Reconsideration",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x991e29ce7343bdda79bd7ed6015c45f8a094c5a2",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9bc076f656685c2a7ef4d4fa2a01f3445bb99556",
      "pseudonym": "Abandoned-Encouragement-Messy",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9c3d67382ffc47fe826451fbb915e2c067fe9931",
      "pseudonym": "Beautiful-Mile",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9c805e4b6c314f59402caf18c932058e7537814b",
      "pseudonym": "Perky-Criterion-Lettuce",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9e0e484dd9f15715f5f8098b14361fc941ed2502",
      "pseudonym": "Athletic-Bondsman",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x9e3ed7b661a903fc97afcf49e0f014ebe869f882",
      "pseudonym": "Favorable-Pepper-Brushing",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa054a910cff3f6d3503335577f12d68a169aa95d",
      "pseudonym": "Upbeat-Politician",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa317462f9c62340a42430b2a559b370c781ec2e4",
      "pseudonym": "Gray-Seal",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa39dce6d77303e97ac549d59392551e17a97511b",
      "pseudonym": "Putrid-Elevation-Passbook",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa3c3c267b072f443cda9b2feee772047c1a513e3",
      "pseudonym": "Mild-Age",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa3d0509c48d64df06b945adc5cba832f71d3fad2",
      "pseudonym": "Warped-Fratricide",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa58f84122535fbe42cec75d70e24ba0dd7e7cec8",
      "pseudonym": "Tiny-Whisper",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa5b3148791fa653dd2cb1f126374084500442a23",
      "pseudonym": "Venerated-Manacle",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa6f064e89a761a14d2972e9c8510c7143b33d8a0",
      "pseudonym": "Petty-Baggy",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa7f41af309092d88fb351ab625ab9dd3d5d3ec06",
      "pseudonym": "Mortified-Sigh",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xa8171c1b8acf891e18a83f6f8f1fdb7bd7ec95d7",
      "pseudonym": "Beautiful-Atmosphere",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xac7bed009c6c3840a054d8537198488197cc8c06",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xae3ed6ae3eee2be5ab95095e15d4ed3a0b679a8c",
      "pseudonym": "Another-Decision-Tomography",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xae660200a22d35b867d41bcb221a90bb48f914b7",
      "pseudonym": "Reasonable-Nondisclosure-Mayonnaise",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xae67057c84b9453e54d2267477d1524124ce4414",
      "pseudonym": "Loose-Country",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xaebb010fc8c90da4acc14ec66c27c137756c9922",
      "pseudonym": "Calculating-Native",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xaec03beedc9deabda826d73e5bacef66cb7d1cdd",
      "pseudonym": "Calculating-Species-Selection",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xafde461fce5aa0fabdb7711c59db93b65e343e1d",
      "pseudonym": "Whole-Challenge",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb00f8041c345aeeb30b29fb85e50b6038e343e60",
      "pseudonym": "Skeletal-Sink",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb0449edead101bc9ff89054db4c20fed696dc00d",
      "pseudonym": "Black-And-White-Cherry",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb123e75212e81277b38aa4ed100f0f0379958e0e",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb3b449c88c717d1b4b799d351160d600162748b2",
      "pseudonym": "Glorious-Median",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb3eb31461a51d92b8481d92c4a3a7a232f012a09",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb430600a1765e3b438a4a53eaa62e0270dc3efc9",
      "pseudonym": "Tragic-Joke",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb64e609fdbd09cfc77cabc8eba3316f0bddd8e0d",
      "pseudonym": "Poor-Making-Thigh",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb71d60a42e3f3542682d93be9f382d9b586f611a",
      "pseudonym": "Loyal-Digging-Opposite",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb819bda5e1c7b4f6ee75ff7c213a06ef248ed4f1",
      "pseudonym": "Last-Plaintiff-Lad",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb93eaae0352495eeb9e777c16de753e8acd7528e",
      "pseudonym": "Anxious-Wagon-Stepson",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xb99b5c2f885769c0c287fa4dfb454e128e8ab581",
      "pseudonym": "Violent-Dickey-Bathhouse",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xbd138dd3d9150ae3316621901466620cc9a93fae",
      "pseudonym": "Virtuous-Poisoning",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xbd7387cc09d32bd8f7644be95e7b20a2de6b2e72",
      "pseudonym": "Clear-Thorn",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xbda9cd0a14406821abfe696672231d7af67a7009",
      "pseudonym": "Staid-Molding-Shopping",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xbdb3316be2ff10a70c3c8e4dfbfd1f2a735b04ba",
      "pseudonym": "Zigzag-Latter",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xbec2eddb9000d4c86835895aeef4f31fcb69d1db",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xbf3d1b94418e7585ca1746b733b4d44580c5558a",
      "pseudonym": "Extra-Small-Eavesdropper",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xbfe649584b3ce3cc8d48172dfdf12687707f3043",
      "pseudonym": "Lighthearted-Beastie-Season",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc0a53bf348c84e31a2be35ca6a258f33687c1958",
      "pseudonym": "Mindless-Overload",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc1dcdf61c1ddceaede8429b513802161849448fa",
      "pseudonym": "Sugary-Buzz-Wrap",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc31fdeab99cc3a1ff67f42cf5dbdde35dce0f04a",
      "pseudonym": "Misguided-Nightclub",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc34f6b088bb9172625ee1ea2ee8da9ac4f037d2e",
      "pseudonym": "Thrifty-Original",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc3eb9dfae62d7a07f9563f2a46ec6902d3a1ed72",
      "pseudonym": "Ordinary-Supper",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc629548069e9a5e903bc763080c157588680649c",
      "pseudonym": "Stale-Genie-Gondola",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc6700fb379d24f4166f50cb2608dc26a01b9556c",
      "pseudonym": "Jumbo-Accessory-Bestseller",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc68cb65c976eb7c39930dc762d8b0f41b1ea40e4",
      "pseudonym": "Warmhearted-Column",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc6e299b9f4f97545f86169d8528fe0a8a80706f4",
      "pseudonym": "Knotty-Spectrum-Pain",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc7f8a5ceb600f865289178996d26a4fdfd324722",
      "pseudonym": "Common-Optimization",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xc8aba7dfb539325efa03913dae267f2e4e03db5b",
      "pseudonym": "Famous-Pathology-Millisecond",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xca9b40f41c2cb60d4a48a91180684d1cad460234",
      "pseudonym": "Caring-Backburn-Thread",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xcb46d15937f1692e8ee44711ea709bfa9090af70",
      "pseudonym": "Envious-Kale",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xcb5151339e09e1cd97714f3ae5df62c5b6a32d79",
      "pseudonym": "Weighty-Stream-Discretion",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xcc4fb4f9dd0405a971f992f4cba0011fab1e4926",
      "pseudonym": "Healthy-Textual",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xcfeac35ce3bf82a8cd667a1b99c6545bcf40182a",
      "pseudonym": "Golden-Adaptation",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd04e56d13b8cf3c18602170512fc3b884f0e122e",
      "pseudonym": "Early-Priest-Tension",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd07c8f0efbe67bd01fe4e4a721094457ba31e419",
      "pseudonym": "Sane-Seat",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd1156233fca80629cbf6ce80d86a019e04e74906",
      "pseudonym": "Grubby-Aquarium",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd19bc1cbf20481ef434ba8737ea92cfb9c9fd897",
      "pseudonym": "Sour-Crewmen",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd3547f6d7c4b3ea30e0ca94dbe8049e402df4d78",
      "pseudonym": "Honest-Sycamore",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd372b7468864233aa6d33aa2dda181511c7804be",
      "pseudonym": "Past-Dance",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd378745e2b8140436a6e9a5229088451ab2d8141",
      "pseudonym": "Lumpy-Heartache-Wood",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd4879c2074fd83a48bf2f913db7cf36d1f97fc1b",
      "pseudonym": "Tinted-Skating",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd66da0c713741ce6872e93aabeb7591c705e0884",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd68a050995828994d2b5a230bcd3f0b6a8e0fdc0",
      "pseudonym": "Bronze-Optimisation",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd91e4f1b1490cff64477c039ee7e53ab9cdabf1d",
      "pseudonym": "Spiffy-Sailboat",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xd9d3ed6036e5c67aaedc96ad83cfe8a168a7b1a6",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xda35f97698382ca11bc60b731f0692659cf6b2db",
      "pseudonym": "Frank-Specification",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xdb8972025deaff9baa4b0827a90e23541694fba7",
      "pseudonym": "Unwitting-Basics",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xdbb758b439f6d72c9e7d4374095de8be3c3c8296",
      "pseudonym": "Brief-Affinity",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xdcb5d7bfa80b793c599b650d64da1aca0c94a908",
      "pseudonym": "Swift-Condition",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xdd58d2477c5f81cf7e655ba4e304879cbb033e95",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xddc3815329eed1156a3700a291ccfb0b826b000b",
      "pseudonym": "Frozen-Inversion",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xdfb21f0da9db14c75ed5cf83c7ed7600d8d5fc45",
      "pseudonym": "Brown-Beard",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xdfc3af214550c45ed369ae15e2432d36cea8dde9",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe085ed09d137049c1c47e6fcfb20e5edd35d9416",
      "pseudonym": "Steep-Coconut",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe0faa5901d6d1d2e6faf447204a622d483204780",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe13b9103e90527084fdd726c089e6465b5126747",
      "pseudonym": "Well-Documented-Eyebrow",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe1f4e70709a15df46ed3d69b565794ccb912304d",
      "pseudonym": "Ironclad-Ink-Flicker",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe3ac022f3b4bf2c0c0567f83c437759ac7845722",
      "pseudonym": "Adorable-Ironclad",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe3d6f6d313776c8f42e53f10915d7da35bd63955",
      "pseudonym": "Perky-Scheme",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe50e7c80d4949938f2ba4e811ad1482e885f45c5",
      "pseudonym": "Outlandish-Official",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe5a63812144d7eebc0b7f8f7051e2ac04690d556",
      "pseudonym": "False-Street",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xe6d41758fb2660df648074ac54d03b499f83aa90",
      "pseudonym": "Used-Birth-Aim",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xea2444ee7adc789f8fc6ec88d8515a684ef32cc8",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xeb1b3ef2729ab7be83e1337ec81f24467c7f87c0",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xeb33b695fdfb7ec4fa47dd053173cbc407e9e7e8",
      "pseudonym": "Agile-Nick",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xebb1573b8bec894b06e0db3e5586563d908de7af",
      "pseudonym": "Illustrious-Yard",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xedbe108285993c7b1ab04c03139e82a7589b84d1",
      "pseudonym": "Frank-Angina",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xee9c83787f291b6e2dec2749df998c17dab82e24",
      "pseudonym": "Lighthearted-Foot",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf063aee45ba812a95c46ac391779bc5edc14ab75",
      "pseudonym": "Low-Interface",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf06b66751f8e639475704243a991bbe14072f629",
      "pseudonym": "Agonizing-Alb",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf0fcd89c8e847c319129b8889a71d018b7a6d716",
      "pseudonym": "Adept-Comfortable",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf11593010a6132948dd82318e9f5f32fd78f59a0",
      "pseudonym": "Other-Bangle",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf13242c0f5ed15fe9aec0c5eab40a2a8dbafc706",
      "pseudonym": "Strange-Maintenance",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf225788a76d4d31e298de41f92b8a607d4d042e0",
      "pseudonym": "Wet-Kill",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf27ebaecbe53f348e7a9b12947501139f101b03f",
      "pseudonym": "Interesting-Theater",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf29db6b775fd55d2602291ba44db8a9918037d52",
      "pseudonym": "Novel-Cadet-Happiness",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf2f2df41cd3ff33147e622869ac052ce5ad2d1f0",
      "pseudonym": "Well-To-Do-Rock",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf4d89f7e8c2fc8d2303e0f6b63cdff37fe304c91",
      "pseudonym": "Clean-Gathering",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf51b1d560e33b1c56f8a9a4e8fec3d4800c0ca1b",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf600e8c0bf83c001786c3784cf7eec8e8ce53aaa",
      "pseudonym": "Outrageous-Pet-Giraffe",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf7b4b614e6565f0f067fa2685622e08c7dea2aea",
      "pseudonym": "Distant-Pension-Flintlock",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xf8dc8cd0fd55eccb5409ed99ed90a86bc7f0f31f",
      "pseudonym": "Each-Public",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xfa28c521b5c2c7c81dd55162cda73e401558c37e",
      "pseudonym": "Mad-Refuge",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xfbc14f8eb2e630e60f9ed1e917925c8673002c32",
      "pseudonym": "Cold-Signet-Infusion",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xfc242c0891ed739afe55825109ba9f849b08c885",
      "pseudonym": "Lawful-Interferometer-Papaya",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xfe61efe41a388bd7af3de421e89ce5f83ccc7642",
      "pseudonym": "Ancient-Amendment-Feeding",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xfebea97c319f2cd8fa8f7ff1b467a1e91f1930f3",
      "pseudonym": "",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0xffee18b118b9ea6c3062a4ce3aabd51cbcdaea6b",
      "pseudonym": "Unlucky-Weeder-Mouse",
      "reactionRate": 0.0625,
      "per100": 6.25,
      "ahead": 1,
      "qualified": 16,
      "wilsonLower": 0.011119,
      "eligible": false
    },
    {
      "wallet": "0x00816accec71a24c18475ba18e86199e553c947b",
      "pseudonym": "Wilted-Defense",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0084eab717f58902c1c95819ae2bf0847c932ecf",
      "pseudonym": "Fine-Tassel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0130afd6f3efddf1c3e16e01217b172dd9befb49",
      "pseudonym": "Required-Tactics",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0275ac8f6793cc3ffe90dc1095330e240622b936",
      "pseudonym": "Pertinent-Vengeance",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x02b6bc4f22fe74202794be043e2176e506a3e113",
      "pseudonym": "Finished-Hurt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x036e483707c68af6025a62adada6370e3faa7a8c",
      "pseudonym": "Serpentine-Spyglass",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x03cbfb8980e351319f8e6a7f147e9db12cdc5dea",
      "pseudonym": "Average-Error-Voyage",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x04edac2e1b006ccae26d41f56cfed64ad48f8809",
      "pseudonym": "Miniature-Alpenglow",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x05f8cfd33d0a36100e9608e7c4989b0afdb5c181",
      "pseudonym": "Crafty-Loading",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x07271be69b95268b763b05831fd4d4eda73fd1f4",
      "pseudonym": "Short-Provider-Riding",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0786521adaa5f99006d701e3d68550b1e72e4307",
      "pseudonym": "Clean-Supporter-Destination",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x08187ae292e0cbbf2543519178e03c647b52e59e",
      "pseudonym": "Silly-Sanctity-Nightclub",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0857bb24b2e3dc1385a8eb4c6911c599dbb9c3d7",
      "pseudonym": "Black-Hub",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x093be53055cbf0a9c4ca4c63bc3294de7e88f7d3",
      "pseudonym": "Tinted-Salami",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x094225174ec43f78d0aed7ee7f7a9ba00a57794e",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x094a1fa47971a8151c0430cc7dc35cda03aea9d2",
      "pseudonym": "Robust-Sheath-Iceberg",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0cfcc1b4aee4897f20f3b0728fa846947a567f6b",
      "pseudonym": "Suburban-Colloquy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0d0cfd995874e5b474d1a56f4acb38d61089fce2",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0d7d68d1f738088da381c734d14a62963a727d74",
      "pseudonym": "Upright-Solidarity",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0e923da6370044f6de7c075441337fd92abae6bf",
      "pseudonym": "Gruesome-Motorcycle",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0eae634d0dbdedf1d417d8903da27aa5ebb10de0",
      "pseudonym": "Fussy-Portion-Collagen",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x0fd1f14515108fcc275f4181ff5fe59ceb0747a8",
      "pseudonym": "Sophisticated-Cougar",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1046f143883e92e72cfa9c254228dd6a97c10b51",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1062195479bb686e8a90c926c4c595ee2e1d17e5",
      "pseudonym": "Pointed-Handrail",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x108a7782120894a58eb308e61da5c01c242d8159",
      "pseudonym": "Triangular-Stump",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x10e0304482fa8f8d879447bb5de58040a71792e4",
      "pseudonym": "Elaborate-Vivo",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x121e3181ab6edf97ee1c7701e382e5f5abe55a07",
      "pseudonym": "Lost-Fire",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1359adadbcfef40c65787f5f806fe5f8080a7e7b",
      "pseudonym": "Excited-Pill",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1387d145aaf01f6e33b66525dda6e1f51f6955f8",
      "pseudonym": "Starry-Studio",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x139601372e9cc9b248a38a2d2a0ee49b27bfbb78",
      "pseudonym": "Humongous-Armrest-Message",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x142adcc6031232974212581d5882dc25de02a44a",
      "pseudonym": "Witty-Armchair",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x14916d34b3c976659fba9c4aec1593007ed390f2",
      "pseudonym": "Physical-Jaguar",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x15a1b69d4f48c017af19a49b6b8e9b97d6e55ef3",
      "pseudonym": "Treasured-Coffin",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x16a3c6c383289e96bc1665ef985283c03d6f5dd3",
      "pseudonym": "Heartfelt-Alcohol-Indicator",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1752cf45d3d15d2a63775834770914d802ea3a76",
      "pseudonym": "Thorough-Ox-Courage",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1775de4e5311e4f9f650fc5aa5dbf708a431e3c0",
      "pseudonym": "Similar-Decline",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x17d2d69718e172ffd455348bc14acd703b714142",
      "pseudonym": "Keen-Publicity",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x17dd123a0ad9675e6ed3155724a92b4632af944c",
      "pseudonym": "Decimal-Phosphate-Marriage",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x180e62e6f035dbf69118a2306df25d28762129df",
      "pseudonym": "Granular-Celeriac",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x18cf41b7193e4e4a76cbe9aa38f66d81045b7439",
      "pseudonym": "Dark-Optimist-Wording",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x18e73e0e634d84eeea190eb32b6f58b87a7ffb43",
      "pseudonym": "Fresh-Leash-District",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1987bcfd467253cc6191383b7e719293460023fd",
      "pseudonym": "Modest-Sarong-Yew",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1a5cbf65ac2014d27b4a64c0718d8fc304366704",
      "pseudonym": "Unaware-Mozzarella",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1b29fd072a61e82c870034e25bd81169ef70f288",
      "pseudonym": "Super-Living",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1d145fd334642bd83be3dbcff3ed6a4fc57eabae",
      "pseudonym": "Remote-Tweet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1d7094f20dadb0e5065976cdc86da288e1501abb",
      "pseudonym": "Stimulating-Footnote",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1dacf01b09fb319a0bbd3939dba57e4f7cd63ae0",
      "pseudonym": "Acidic-Quit",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1dd3d894873874cd806691cd3dd46d921232bee3",
      "pseudonym": "Sunny-Modification",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1dfebe22f26b64199a111de6a2a5554ae2efb4f9",
      "pseudonym": "Pointless-Handover",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1e3bb7def89b002d45fd86d37f35918c2618e232",
      "pseudonym": "Devoted-Drake",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1e60d8a80fa1c49b4e5b3f7b0043ef1bc08fdd19",
      "pseudonym": "Trusty-Slide",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x1e98ea08da9c0484b6523a67def2d9b97d34e3f7",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x209f44d8e117c9bc443a3cadae55e6ccc9cb0eb4",
      "pseudonym": "Monstrous-Middleman",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x21168b1447aea2cdd4746cea893b38c50876eb8f",
      "pseudonym": "Querulous-Pincenez",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x216509be5332c6037105b4f871966eb97240f598",
      "pseudonym": "Cruel-Bowler",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x229c0a7d92977a9934e5ac2348d507988996b966",
      "pseudonym": "Stale-Cashew",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x23b824765e798febf65ca05bcd42d2d9dcfb0930",
      "pseudonym": "Talkative-Anchovy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x23dca16267d26881b0277904aadb5dc4cbf265a7",
      "pseudonym": "Any-Vagrant",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x24202d48e575576d209ee41afb728a8cf2cce50c",
      "pseudonym": "Playful-Tourism-Aggression",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2532e2d26dfad61379169efea17fe6112d4e28ba",
      "pseudonym": "Glaring-Player",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x28a6654044848bf6f98a002e7dc8628f990fd399",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x291d4e2a3662bfd36a52baba9582519980418e36",
      "pseudonym": "Unkempt-Leopard",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x29863c41d339ba0710b7b023cb5a2e2d70c3b3a9",
      "pseudonym": "Evil-Watcher",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2a6f7b6306c81908a1a25fbeef624d6fe1db2351",
      "pseudonym": "Famous-Sadness-Buck",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2a739af746fdaf24e7d4b27f8ec948ab9d63a631",
      "pseudonym": "Real-Filth",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2b2729f7bfe848f31d22bcbd1916d13fb2a4ff88",
      "pseudonym": "Disloyal-Enjoyment",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2b733d127f58809ecf9917100a7f7a946f6f174e",
      "pseudonym": "Slimy-Coin",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2bb801202571cf17a4128dffbcb96360b270f2cf",
      "pseudonym": "Waterlogged-Hubcap",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2c10ea80e3f2697545b2d00f3f9d9a7490ac5269",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2c8647a7d94bba38263d39a18dc04e65e6e3740d",
      "pseudonym": "Quiet-Prejudice-Statin",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2c883bb308472fe276025be0c6fdb4a8f74316e5",
      "pseudonym": "Soulful-Burden",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2d33604e15371518bd0bceaf8081c9827614a77d",
      "pseudonym": "Unwritten-Destiny",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2d62575f0f91f0c031b9168f865dd43ae37f0a41",
      "pseudonym": "Formal-Sunrise",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2da4bb15057a8775dc859c6f85e65877845656fc",
      "pseudonym": "Wide-Eyed-Builder",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2db27f4b7f6ce9b085e34013e91cb67702e4de50",
      "pseudonym": "Wise-Display",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2f2ba184f8aeb66786696f4b6e64f2523aa26a39",
      "pseudonym": "Fresh-Discretion",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2f45248a9d36ff73754e68974560d36e8c1bab6a",
      "pseudonym": "Content-Digger",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2f547224dc01fe49fc81edcf2ee76e10fac5252c",
      "pseudonym": "Stable-Administration",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x2fe21aec2dd7650b5cd9807ba69225f7c1cbec56",
      "pseudonym": "Growling-Restaurant",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3024712d12a75c911f8abf2a88ad44e3a4778ece",
      "pseudonym": "Willing-Drill",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x304f0434d6ef93d9d9795f7ec2cf945eab117d3c",
      "pseudonym": "Silky-Spectacle",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x30c53317fc15d7eb8acde5c259a63d1ac0c38511",
      "pseudonym": "Blaring-Sparrow",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3127410fa5ce723739d24a651804b992a0a15514",
      "pseudonym": "Warlike-Production",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x318650e175b2fb42969973c8c83a946e1d6d1754",
      "pseudonym": "Multicolored-Cloth",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x31a47ac5c37891a38c971ee497f1883bbf4edd86",
      "pseudonym": "Low-Selfesteem",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x31afe78ea1d3222a2da50ba8e3e383c8d6945c86",
      "pseudonym": "Eager-Sink",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x33151ea579904d4cefe51590b5efb26f1f1f2282",
      "pseudonym": "Showy-Timeline",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x33531671182866d943bf91ec4e8237411341e5a3",
      "pseudonym": "Flowery-Publishing-Appetiser",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x336ec9bc0d9fc64647c930c46e2232e7e3e671bc",
      "pseudonym": "Separate-Eel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x33ab2bd0486f476d27e0e32349ef41f6f032149b",
      "pseudonym": "Medical-Acre",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3486a406949cdec57f5194dcb92cafa0f45b65f5",
      "pseudonym": "Idle-Counselor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x34c4fadc63a048d748a8809cad47350647e674b2",
      "pseudonym": "Elementary-Ownership-Vest",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3504755541dfe2a3ffd844ecb6ba2ca25bf5a832",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x35e3bd6dffe41ee08ba97633013253a495260df5",
      "pseudonym": "Musty-Generation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3636c40719df4dd24d04b8d1a41b8a26be9234c4",
      "pseudonym": "Sane-Ligand",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x36901eb0f21519cc9055662a6d2483e96da1e16f",
      "pseudonym": "Deserted-Bitter",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x373e1cc0a2d1b650942bfaec8eafcbf2c756b868",
      "pseudonym": "Plush-Reindeer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x38043374c5a33d8d7e77f4c4201883cb980e1fba",
      "pseudonym": "Elderly-Cria-Discussion",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x389fffb8d93abf7aeebed476f4a6a707ee53480a",
      "pseudonym": "Cheerful-Whisper-Bottling",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x38caab7e72b2e60c3dabf67417e4992c765a5a8a",
      "pseudonym": "Deserted-Ironclad-Advent",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3942201b99241dbbde9fdb515a0be8db229739d7",
      "pseudonym": "Upset-Elongation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3970ce9259501e736a4a1bfcd6e643d68a28f56b",
      "pseudonym": "Useless-Adaptation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x39d479219cfef113d3caad2f089772cc4a99b5b9",
      "pseudonym": "Extroverted-Description-Rally",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3a0a85fd0c91fb7a7123cd709f33a3e51e0737c6",
      "pseudonym": "Insignificant-Survivor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3d3171c2aa20f36feb5cac0d492a8048ab9513c3",
      "pseudonym": "Prudent-Morsel-Million",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3db1cc09caa35234493bfb6d9e83adf93c96fdee",
      "pseudonym": "Worthless-Ordination",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3dd1cf0515af12542488af04388404fb056e557e",
      "pseudonym": "Sorrowful-Text",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3e9001c185caafc7f242395b08be50cde2026303",
      "pseudonym": "Necessary-Championship",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x3fc83d2b40f9f243cbcd51a53cfdd7e9a6d366a1",
      "pseudonym": "Unlucky-Waveform",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x406d71a3652fd3517a1b0f0a435424618b7b1132",
      "pseudonym": "Loathsome-Pioneer-Efficiency",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x40fb16192141abfedc36c824edef3ea583a23cae",
      "pseudonym": "Villainous-Chipmunk",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x41105af09dc9e3f4c012d0aa12b9414cf0f9f55b",
      "pseudonym": "Musty-Bamboo",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4167933f6c0f059765b5c8898d44cc342af6f99a",
      "pseudonym": "Hairy-Chives-Soy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x421169c191cc1d9375fcee955de71f70d11409e3",
      "pseudonym": "Unkempt-Implication-Nitrogen",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x43003d72b125a838d86dcc72c62be7027fa4fd4a",
      "pseudonym": "Pristine-Width-Ratepayer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x438795da8f159379fffa70f2b545256c6823afb3",
      "pseudonym": "Stained-Barometer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x45c59f6dda3d2dc24442d73036dbb02bbead2a38",
      "pseudonym": "Menacing-Brewer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x461c4c0e4100468390f0f3fd0b31953769ca4825",
      "pseudonym": "Pushy-Minor-Spokeswoman",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x476e10da2f129a1c6c1db2d86283b1f4d2dd1eec",
      "pseudonym": "Ironclad-Sickness",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x47e9c1e3a3d7aa76b22b13d5ebd46d82ddac732c",
      "pseudonym": "Horrible-Pusher",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x48919ad3852818cdb8d7f2dae6837db160eb1bda",
      "pseudonym": "Diligent-Rhubarb-Eyelid",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x49610ef91edf1f322b392020d0be173359053531",
      "pseudonym": "Strident-Commercial-Swell",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4aaf3b7df0d9ce28243a29fb668500aa791ee80c",
      "pseudonym": "Lopsided-Scimitar",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4ac44393954b5e4d31a40a6f25d8c8d170033ab4",
      "pseudonym": "Weak-Outlet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4bf5deb8d4593e2c03e9d315e4d3c6281f0829b7",
      "pseudonym": "Mammoth-Tapioca-Compliance",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4c9c259bc1ce9bcdeba8f0d9eee3036818678c2a",
      "pseudonym": "Dear-Buckwheat-Institute",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4cba503f5d35f54ed37dfe7ef55b2b1513785352",
      "pseudonym": "Ruddy-Simvastatin-Evidence",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4df3b5623f43a4d70530486dca03ad0f01a80d00",
      "pseudonym": "Serious-Bidet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4e075f2ff95ba1327d8ea84bd3662f69817b9cf2",
      "pseudonym": "Boring-Tapioca-Bolt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4e4ca20398446cc2627cfa9b4b2b1a8c65922918",
      "pseudonym": "Querulous-Young",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4f0f8a24fd98ec9e152eeb98d4745a3436d76f7e",
      "pseudonym": "Partial-Surgery",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4f1a1eae1ba4cb2a7d2950b45c3c88db9dfe0613",
      "pseudonym": "Hideous-Storey",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4fd9a67bd026faefc29c39bb998a9ecdc90c49b2",
      "pseudonym": "Cold-Tactics-Outcome",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x4ffe508fd64cc1f6ceadf0a35c0ccdcb08a08d97",
      "pseudonym": "Naive-Motel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x50056e920328c27acbdc21d74cf3ffce52e723fe",
      "pseudonym": "Unsung-Greatness",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x50ea22d916bfe065b64bd280311a0f49701a46fe",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x517e5c21e89aeb095a8365006ab8c42498270b70",
      "pseudonym": "Exalted-Passbook-Dress",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x52f99b85bf540020be63b7fcd8e1f1935dcac4f0",
      "pseudonym": "Scrawny-Decade-Center",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x532b5437c9e83a35554b3daf6057acb40222cccc",
      "pseudonym": "Humiliating-Bed",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x54498e4c40b17261479aeaeeddf9cc37bd46992b",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x54e00a1ceb7f3b7c0bd240d1deeb0edb6b0eb02c",
      "pseudonym": "Wary-Fog",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x54ed6f46194e82badefdb7c00459473b5d620854",
      "pseudonym": "Actual-Grocery",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x550acd0cb4da0d3a223ee2acae8c01d5e23b96da",
      "pseudonym": "Expensive-Asterisk-Spume",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x554c347993aac460c8facf33d2cd5a25f4f7b561",
      "pseudonym": "Handy-Shadow-Reverse",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x554edf65674655e58d0e397394c70cf6e47ff375",
      "pseudonym": "Forked-Candelabra",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x55690f3e5b022a6b139feff7df7187b1085434c7",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x56becc35e9b70359363113e04aaea1504b535922",
      "pseudonym": "Thunderous-Loaf-Recapitulation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x56c83e772a6ba4f637a1812d85a5be16eeaed0a3",
      "pseudonym": "Glamorous-Pinot",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5780ae8354a400302885e00e8332c603929d2914",
      "pseudonym": "Neat-Community-Gloom",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5957e0a90236e4148d817c34c8b08e92e84221f0",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x59dcd58551f0deaac6956f663432bc2352df2c46",
      "pseudonym": "Gray-Haircut-Debate",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5b6e9bce6d8a533017e7f16987c9854c5da955b9",
      "pseudonym": "Instructive-Larch",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5b94b1181d238bfbd52391408c7f8c3aac67c769",
      "pseudonym": "Absolute-Chowder-Saloon",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5c3e96322be0a930ca581ca938fdab2716a5a917",
      "pseudonym": "Enormous-Burrito",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5c701d46b289923588abd14e1ddf4293f500edf3",
      "pseudonym": "Enraged-Pita",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5c8da449cbb1086634d537c46253c07a63b14662",
      "pseudonym": "Fond-Shame",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5d1048f76c13558f9c3a25685d960357957edca1",
      "pseudonym": "Honorable-Dinghy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5d337908c5116fa5dd9d82b4d59be922c98f6be3",
      "pseudonym": "Descriptive-Herbs",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5d3786bfb4c2d026d81f52fb4e62ff75cdd30e5c",
      "pseudonym": "Stiff-Whirlwind-Emitter",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5e9928e5db1e3358ac842176465fdcd53e0ec205",
      "pseudonym": "Fortunate-Asphalt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5fe702a22270023d8a64e2e882e82fea76b6440c",
      "pseudonym": "Sparkling-Beggar",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x5fe79a73af0a8ad6a83d89256026b14f35981ea9",
      "pseudonym": "Focused-Monger",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x611ecf945109dd2c0cb88f1d43a1a064b1b38ee0",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x61dd3c385adf695ca6b62018f0fc8e5904b2cbd8",
      "pseudonym": "Both-Eicosanoid",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x62690e8a08345c6c5f9dbbedd544aecd9fd711d7",
      "pseudonym": "Klutzy-Dimple",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6282c1b33adc4d3e799a5ffc9ddc2cee74f235d0",
      "pseudonym": "General-Order",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x63540a1a71d2c0f01ed8676c1086b1625b4ea1c0",
      "pseudonym": "Muted-Handball",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x63ad1769bc4526a73fe74e823cca4b680554b51c",
      "pseudonym": "Bare-Time",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x65fdb92ee1385ab9083d3bd9d177ea8396dcf2ee",
      "pseudonym": "Daring-Dishwasher-Tutu",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x67e6dc204dc01833aa811d5bf581d091a0f12210",
      "pseudonym": "Common-Haunt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x68cf12e1d34ab9cc170a79b035c1bbda3c1a9b9c",
      "pseudonym": "Spectacular-Pennant",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x68ffb08b986f9ffc21d9e69bc335d3b1793c6734",
      "pseudonym": "Hot-Millennium",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x69165d1ae30831e6fd97c017b995e8e9654eb44b",
      "pseudonym": "Informal-Work",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x69b5450118b6395706bd1dc6b5371dbd77676f35",
      "pseudonym": "Charming-Cleaner",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6a56ba3d12bf5c78219ed240a5fc48c97cd9be30",
      "pseudonym": "All-Committee",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6c06bb8ccea81d94f0f5681235c155836f00171d",
      "pseudonym": "Useful-Teen",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6c076f97774e7b2e4c992f4bc66978c63bf72219",
      "pseudonym": "Trivial-Signature",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6c2d15e5a99b09bad333fd6ea77b4c8a14e31c69",
      "pseudonym": "Worse-Meteor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6c30c2babd3093ed122308caf6e0fa5dfba1ba88",
      "pseudonym": "Prize-Copyright",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6d77ba679c455cd7007bf897cc3a42c9e496a694",
      "pseudonym": "Scared-Decrease",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x6eb4c9534e4ac2a41c62cf6a45c59613448dd18e",
      "pseudonym": "Hopeful-Caravan",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x702319970bd0652611a292b068a3ffd00479e522",
      "pseudonym": "Quizzical-Archrival",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x70e2b50b888d76e9a279bdccb8da451e9a4667b4",
      "pseudonym": "Calculating-Spectacle-Hail",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x718c1115fe0f97715cd0f55a510d4c513c7111e0",
      "pseudonym": "Few-Foal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x71f92cddd78bbafa4aa1510ebbab67207c36f939",
      "pseudonym": "Distorted-Stench",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x721a29613c653d9430532402784c8b25ad5d9295",
      "pseudonym": "Bewitched-Auditorium",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7271ffec32de9aa1bf71287afb06042a38dc57ad",
      "pseudonym": "Fluid-Haversack",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x73534402899084573c0f0ddc003674eba01cb6c5",
      "pseudonym": "Amusing-Towel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x73d0fd8b33ff4a6a668bedcd846c4d2a4bd36972",
      "pseudonym": "Calculating-Botany",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x74957ea27ac4fbdee46d861fdae357859ff67fcf",
      "pseudonym": "Evil-Row",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x754b36af5e01e56b15acc45a5b27102a0ab9d06a",
      "pseudonym": "Silver-Perfume",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x75b086ade880292697fc38e363275be91282e7b7",
      "pseudonym": "Delightful-Thanks",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x75fd9df26d73c9f83a6e10c97942be7c0983e4f9",
      "pseudonym": "Stunning-Greens",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x764b305694b026c1acce7bf862c3b5456a146bad",
      "pseudonym": "Glossy-Believer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x77a48b386608855ef0792635124d3468e52fc217",
      "pseudonym": "Intent-Cuticle",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x77b8d67589ae2b55abaab2f3f744a1fac555e849",
      "pseudonym": "Partial-Practice-Growth",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x77deb99a65f90607e42f2bb37332b8fa7f489107",
      "pseudonym": "Spanish-Dictionary-Bracelet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x77f069c3233901628c89d0e8ea5bb510a2822b1f",
      "pseudonym": "Educated-Jodhpurs",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7ab34ead62c51889ed6439eeef7f7e9cb343c4a1",
      "pseudonym": "Subdued-Corporal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7b2007f18b374aa05c018f65ced5084daf6aeb02",
      "pseudonym": "Athletic-Trace",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7b407cab52675e8a52e965a78887969950a73c4f",
      "pseudonym": "Attached-Concrete",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7b735df26e185422affa5752d75e1decd290fe6d",
      "pseudonym": "Light-Disposal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7bbe0987962a6cd2728d1656e0465e7fa8cab95e",
      "pseudonym": "Sizzling-Paramedic-Collector",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7c04355c5d9f9e178d836747cc9e9768f2e03719",
      "pseudonym": "Zigzag-Cormorant-Eyelids",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7dcf235766e6b09c8869468a75d5495cf171a7bd",
      "pseudonym": "Worthy-Jockey",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7e16422c35d67872932e8111acdb4578d6457f14",
      "pseudonym": "Rundown-Listening",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7e7f2af48da8c6843d42a60e8cea6ba16ba47980",
      "pseudonym": "Separate-Stylus",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7eb5812d338c95953f7980827fe4d1f4a38240dc",
      "pseudonym": "Warm-Wetbar",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7eecec255a1ee7a2d719d4e8a1638608bd04c8ed",
      "pseudonym": "Dry-Embassy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x7f353546fad8fe941025d2c5062bf6912f871b61",
      "pseudonym": "Zigzag-Spec",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x80316a4e38c8826f7e84c90083edd98cf2d9c84c",
      "pseudonym": "Unfinished-Precedence",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8088437c471dbc146a393b7b4937eff1a9d9b3e3",
      "pseudonym": "Unfinished-Criterion",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x80b1d29382aa27ff13a0bc9f63e224b6aec176e1",
      "pseudonym": "Valuable-Color-Goodnight",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8201465a8e76af8fcf48ab889a62e4cd03e8f97d",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x82d923f4aa6e623108beaba30a09615c429802a6",
      "pseudonym": "Shrill-Bachelor-Thunderbolt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x82ef890627321c11e247f403ab01a533143180d4",
      "pseudonym": "Definite-Actor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x83733b87090cf97aee473b1000beb9bfab7af0bc",
      "pseudonym": "Stunning-Spur",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x84dbf05372d9795a105601ac98b36ca37740a72e",
      "pseudonym": "Cheerful-Doctor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x853cf39793472815f7d838fbe0164e4c8a6dd854",
      "pseudonym": "Extraneous-Bore",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8575467a6743c81ef0a8d06acc76e99b454a87fe",
      "pseudonym": "Pink-Outfit",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x87674c4c777031bc0f492815d3ed0ba689a74368",
      "pseudonym": "Superior-Greenhouse",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x884215d3f189b3de644d2f1cbfaedd25d4fbdfa7",
      "pseudonym": "Handmade-Measurement",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x888edefb99a2129728c9a79cb9a3eaab20bfad54",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8a25f9c7d093089c808f514b161a1e40be44ba81",
      "pseudonym": "Shameful-Dictionary",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8a5f793f0431bbcb29c2fb71172cd82f59c3d2d9",
      "pseudonym": "Rowdy-Expense",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8a9245eb0679238f1be4b99f09ae63b7c49d8586",
      "pseudonym": "Untidy-Link",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8ab498d2aa467e5dfc05db2b2cd300b237616f38",
      "pseudonym": "Profuse-Gravitas",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8b2916a348a20db395a82eed91d28c7e6eea51fc",
      "pseudonym": "Paltry-Orient",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8b3830f0046b7da2c4b5cb72ed199c63e22f52c8",
      "pseudonym": "Rewarding-Psychologist",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8b92f291ebe788de0cc4d2bd2617336354e26866",
      "pseudonym": "Fatal-Stopsign-Rabbi",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8bb40f5440e2b70705f4b58e0ba965ddb8b50395",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8dc6b0357089f3543bf286bd4252f64a912e22a3",
      "pseudonym": "Scholarly-Denim",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8de1ada629585a5fde78aae39b38337a60b9664f",
      "pseudonym": "Punctual-Pad-Consequence",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8e2127e40ee9e6866184ccced05694df162d0f9f",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x8fe730b55cf3468c01a884cfcde79c2dfb4d6c1f",
      "pseudonym": "Powerful-Waste",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x924cccd279d64365e941b902f84840d893920fad",
      "pseudonym": "Compassionate-Roster",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x92d26e16356b646ad22233b490ffa54355f62d7d",
      "pseudonym": "Mindless-Date",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x93a4cc290b4b2d60a211c0c9b9dd94caea6e0e90",
      "pseudonym": "Stormy-Clue",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x93a71bfde8514ebfeceb6ad33da1b84d547eb7c6",
      "pseudonym": "Next-Downturn",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x942e79166821f3f4e67872e44f1672fcccd2be27",
      "pseudonym": "Joint-Lard",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x943a7f86f0454211d36606bf6025482549dc8234",
      "pseudonym": "Frequent-Framework",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x94d79be3b06b4e0d3bc81058732e5207cdf0c5a6",
      "pseudonym": "Scary-Mine",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x96c573e83a4d199ed6bfd26b9960829731dbd29c",
      "pseudonym": "Kind-Front",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9732f622c04d7d91dc0637fe0b6c7ae02d62cd57",
      "pseudonym": "Irritating-Anchovy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x980b778659bb90ea06d1019eb2883786f8cb4f24",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x98a7a2116d7cef0f11876a6bec10bfbe30dc9dce",
      "pseudonym": "Miserable-Espadrille",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x98a88cd1518213bd2d0e65f40dd7a67a9c2ca47b",
      "pseudonym": "Speedy-Spine-Rowing",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x990ec76efbf0bd617f65e24f91c3e03f749b876c",
      "pseudonym": "Jittery-Receipt-Boulevard",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9a01d2aaf8b4a5ec84ea00017db40005350bcd36",
      "pseudonym": "Nautical-Dwell",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9a94e5b4f0d6c646ed49e832cf8142c45474d5f9",
      "pseudonym": "Nonstop-Knitting",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9b71793208cf32a8c3c3289a778f3f4e41b8c042",
      "pseudonym": "Average-Prestige-Bamboo",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9ba7e68ce42e6ba307f6545e3ad89d3d8bbeb5fb",
      "pseudonym": "Quintessential-Cricket",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9be90ea78bff3f81f3564a11d5e12b2a0783c030",
      "pseudonym": "Second-Fabric",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9da0515b9896a91f2262ccf45147890b432b98c4",
      "pseudonym": "Warm-Sonnet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9daa2fae4ed179a77cc1c3bf1356d9cec6fc9904",
      "pseudonym": "Celebrated-Howard",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9e9f8fda906224c63981001cc266f2f73c858212",
      "pseudonym": "General-Appearance",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9ec1e33b9e4de748ddaf38287fd6a0f9b8de215a",
      "pseudonym": "Aggravating-Caddy",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0x9f208e85f326f865077fffa68b32d8b0e2bc12c3",
      "pseudonym": "Broken-Idea",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa228e8e2085a664336c0ccb1883ffce3612e99c6",
      "pseudonym": "Overjoyed-Trader",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa276eda8cfcfd74ad7f2290ef3fcdb7bd77b9540",
      "pseudonym": "Boiling-Grip-Lark",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa2ffa2cc76d44d2429ebc9eb44744e414cfb6ab4",
      "pseudonym": "Similar-Grove",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa33d25630fb8b779ea9744bc6dfab536272f3ef2",
      "pseudonym": "Scrawny-Reporter",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa3f0b63cc320411f24bc44c8f0de2f1e9d775cd7",
      "pseudonym": "Dishonest-Witchhunt-Rice",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa4410551ff45c4927e5e8f3408e060914072bd35",
      "pseudonym": "Better-Durian-Actress",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa478ff2679b2146f0e32a464c8f86fabce24c87c",
      "pseudonym": "Lumbering-Military-Anniversary",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa4f4739609ea297aa08aeaebe445d4026c920941",
      "pseudonym": "Electric-Suffocation-General",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa776f3bc3f7b70bf9c19701517d23ea064a2b949",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa7e21bda79065c4616d686b463b0a184e7e19b56",
      "pseudonym": "Black-Racing",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa86f687d7eed8760decdbf3dd6d7ed59c1e8022c",
      "pseudonym": "Solid-Pinstripe",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xa9be20fddf2da33ec822a643de3a96376fbb5c6f",
      "pseudonym": "Earnest-Mister",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaa2423fcdd3fe5c2c420df7148d58790876e3036",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaab5c17dddf8a69caa6e2c10b224eafc23efd423",
      "pseudonym": "Experienced-Inquiry",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaaf6a40c1396b2b5b4c4bbf8da05ac8893484313",
      "pseudonym": "Jaded-Cruelty-Cephalopod",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaaf7827a575d9a622eed86768d136d6b7bc5443b",
      "pseudonym": "Shameful-Raiment",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xab5fecb36093100094d7689a6dec904ed577d6b9",
      "pseudonym": "Heavy-Colony",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xab95b07a8976ababfd39ddace5c857d2b102dba8",
      "pseudonym": "Putrid-Bachelor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaba743a752406e6ed8e992c7a3f8e2217c6a85ed",
      "pseudonym": "Harmful-Commercial",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xabc195b12af8f67ed4bd5df22c64cb604e52d8f5",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xabccd7b40aa2b1dfe90702a632a7669cbc448ac7",
      "pseudonym": "Oddball-Seat",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xabebab465b5aa530314a674e013f00c31bf78698",
      "pseudonym": "Trivial-Dress",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xac53920bf4694f095a58e2e5db0a016c2ff6b79d",
      "pseudonym": "Advanced-Cave",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xac9f406c5c703beb25ca4333185734a35bbdd09e",
      "pseudonym": "Perky-Pincenez",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xad5353afe30c2da57709e2704ef3ccdcf67eef24",
      "pseudonym": "Belated-Glue",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xad8ace7c7323f7fa8ee67f836cf90eed8e541439",
      "pseudonym": "Milky-Objection-Hamburger",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xadc2140a4b76a75215e02929083186f7d73a2bea",
      "pseudonym": "Selfish-Mathematics-Codon",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xadcefdd84ffd58d9500c4d03e328b016ef94a482",
      "pseudonym": "Notable-Snuggle",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xae2a545c068389c5aab3466cecef33259e55384d",
      "pseudonym": "Murky-Repayment",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xae338742f25b131c63cb7c7a5d30485fbe557804",
      "pseudonym": "Deep-Gerbil-Weeder",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaf7894f619baae36b20ff2193492b954df76c915",
      "pseudonym": "Stunning-Mousse",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xafd5274522c6ee21489a85d23e4036e4dad062f3",
      "pseudonym": "Royal-Kite",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xaff9effcbebb93f065f8df88e6072e8345e98e3c",
      "pseudonym": "Natural-Rehospitalization",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb0747e0f8d0a274fbca4b6304b5525a854919fb3",
      "pseudonym": "Young-Chitchat",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb0c85813a7a4428f1139ff91d3118a92c391fe7f",
      "pseudonym": "Victorious-Tape-Max",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb12547a9bc3105ff7f6fb481d0ace6235313089b",
      "pseudonym": "Lovable-Lumberman-Affair",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb225817aec248d4cfd32a3181f67bd0844ee0817",
      "pseudonym": "Well-Lit-Appendix-Cosset",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb22ae2678733e6cebc5dc43b68fc70714f932815",
      "pseudonym": "Powerful-Asymmetry",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb26dfe6953c9814f03b7f16ac4c717305b4673f7",
      "pseudonym": "Made-Up-Ingredient",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb3aa67d0b50ed0157c9bc074dbb1e3f2154421f0",
      "pseudonym": "Delicious-Carpet-Troop",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb3b67f71bb33534295370ed2a41cdb91f1260d2b",
      "pseudonym": "Pure-Pantsuit",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb3d4485e04f4b721e04513800d312a31579a1b26",
      "pseudonym": "Agile-Emotion",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb41058db3a897bad890a9f46cfbce02bb403502f",
      "pseudonym": "Unwelcome-Violin-Birdwatcher",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb49ec8dc100689ad5ccc27f804b48149923526fe",
      "pseudonym": "Frozen-Chaise",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb4a0f89d213e065ccafc8b68d3c964e091ab9d29",
      "pseudonym": "Respectful-Altitude",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb5aec62aaf2b4aa764b3bce4625056ab9479b4e8",
      "pseudonym": "Shimmering-Mixture",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb7891265dc16a91bd2c59bc02bbc8469f2548812",
      "pseudonym": "Luminous-Cockroach",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb858e2500562a842cd25bf4a8bdd1c34867021a9",
      "pseudonym": "Boiling-Cord-Armpit",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb8fe807aa951e35af53fd0fee36abc303864ce76",
      "pseudonym": "Prime-Basis",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb8ff6205ba87ef47ffdeab1185366387e91ef9e2",
      "pseudonym": "Vain-Brush",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xb9505324fdd10a77714e8cc5792b23abeb26ab86",
      "pseudonym": "Ample-Chalice-Hyacinth",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbad78de9cc61e503597738d0ee1e930f00005498",
      "pseudonym": "Every-Charlatan-Pork",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbb40452f5da207fa8d153db7b514ed290f042254",
      "pseudonym": "Noisy-Pita",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbc0655bab005ee280aa8332f309b4c90f01fbc87",
      "pseudonym": "Hard-Hearing",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbca96f0566ccdda38685338a3c0099e48f700266",
      "pseudonym": "Hearty-Sneakers",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbd013386f7a70b5dee398029ebb5f050132fd8cd",
      "pseudonym": "Agile-Anybody",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbd84ec3cef7dcae63e57afda896257ef503a1ba5",
      "pseudonym": "Musty-Scripture",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbf697b90108b3ea8f61ca3401a3706e421b5850d",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbfa09746cdac8268a0bbd9a3d9da0ad0e0491a65",
      "pseudonym": "Portly-Authority",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xbfedee642df97c04fa7d832e9e262be8ad53e080",
      "pseudonym": "Unfortunate-Newsletter",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc017cbea62f517b787fb8eeb08b5d4d7069fc979",
      "pseudonym": "Trustworthy-Mutt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc04bab891de314118a92caf80ab2b040c3231389",
      "pseudonym": "Beautiful-Nightingale-Vase",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc057038220d86fba82e4070fd0e904973e38cdb7",
      "pseudonym": "Tough-Fillet",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc1200dd35a85da9b9ba552582d6103dd3d39a7e3",
      "pseudonym": "Beneficial-Girlfriend",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc22b72b0fec23b797589ef6778bb6589e325deab",
      "pseudonym": "Measly-Choosing",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc260cd3f058efc1db47c8cd07b8f2533dcebae28",
      "pseudonym": "Flamboyant-Eveningwear",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc2d995b0b2144527f71b6472bac645e6670982a5",
      "pseudonym": "Useless-Robe",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc3dc54232f3e68114a55f67c5f5ce8c3efbc1ba5",
      "pseudonym": "Lopsided-People",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc3e7d954bbaa1d09f38787611f66fd709425ea82",
      "pseudonym": "Thin-Rail",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc515a1cb96bf264c92e81d98e1e28f5f6acfdf75",
      "pseudonym": "Warped-Citrus",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc5187cb669690150643ba2f9aac6b7d98d212594",
      "pseudonym": "Spirited-Priest",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc6661db6889501bb744cbcc73494d853a94e2582",
      "pseudonym": "Lumpy-Watermelon-Hassock",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc74621ceb1f0268b2d5ce520d56600b1890123d5",
      "pseudonym": "Slimy-Alpenhorn-Archeology",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc868b110afbc212240d9e8f3e4b74000e09d8735",
      "pseudonym": "Weary-Slapstick",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc8d52a4d98c1294a26f6845562301f6b98a5b02d",
      "pseudonym": "Grotesque-Money",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc8e53b039a6052023ce09ed974734d9776a2494c",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xc981909e1075cb1ee83094b37d98341333468d79",
      "pseudonym": "Scientific-Flintlock",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xca08b93c3a7e51bcf8a802314931e026150c28a0",
      "pseudonym": "Sniveling-Vista-Wrinkle",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xca2a0ca467c763cef83085caca47d1dd8d058e86",
      "pseudonym": "Taut-Ebook",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcacffc36bad87ef2802a0734ff95e82bf400f21d",
      "pseudonym": "Spanish-Baseboard",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcca96722a7a98c764b10be70f9711890701eaf95",
      "pseudonym": "Limited-Yacht",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xccc414a0db8e757c97bd628415553fac4f0e4193",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xce89c4b3cbb86522208f20ebff532b765aac8612",
      "pseudonym": "Excitable-Makeup",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xceb42459978f0ae88670aec0cdff96e9aa64f81a",
      "pseudonym": "Ecstatic-Catalysis",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xced2cb53a9715b2530a55b2527b709b259c80d6b",
      "pseudonym": "Colorless-Survivor",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcef6c12ad7036a2cf4e5f5a845fdc9d58a3f2ade",
      "pseudonym": "Pessimistic-Hospital",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcf1b7e678741f4a57522b4aa2e5788ff8086b70f",
      "pseudonym": "Medical-Sandal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcf8b32e3337f0007a51f4f35ee4b265fc1684ded",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcff4d7c6c3fa4c1c72158798562884390f36cab0",
      "pseudonym": "Jittery-Sunrise",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xcfff4295288ee29f75a38a7028611b7c1e93673d",
      "pseudonym": "Miniature-Drive",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd06103558364d75df0014690f5daa347e49ed76d",
      "pseudonym": "Slimy-Ruler-Spectrum",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd0e696b340b42a7d8251ec7c49911e6ee0bda6ed",
      "pseudonym": "Evil-Spelt",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd0fd06e59d5c20c10c5f26ef0762c79f854f0ff3",
      "pseudonym": "Witty-Fender",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd12a261dd2117a8563c7ed53352b4ea22693ba72",
      "pseudonym": "Meager-Excess",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd14dc8f4b7d02f6cd260d7d1be673835e2f1b4cc",
      "pseudonym": "Rewarding-Cost-Isolation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd1519fc9bb6cba5ce215e456f707834ceac185ea",
      "pseudonym": "Moist-Reveal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd19c399d2804faf6797565a08991fd9159ad160f",
      "pseudonym": "Ambitious-Encirclement",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd218e474776403a330142299f7796e8ba32eb5c9",
      "pseudonym": "Attentive-Crewman",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd50c26f9e8fd4fb84f7c8cbbef387907130c010f",
      "pseudonym": "Close-Scenario",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd5ef4a8cbb823390f0aeb3abebce94b88cb98b8e",
      "pseudonym": "Flawless-Pimple",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd68e95bd9aacac9fe57c951393feaa613cddf46b",
      "pseudonym": "Ideal-Pawnshop",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd6dc31d6d57bcbed4fb61aab9b8f5dba442870ed",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd78f3007287cc68e23823730b1cd21a01665b76d",
      "pseudonym": "Gentle-Nourishment-Athlete",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd7e52fcc07840400652ff9bbb404f996d7584c4a",
      "pseudonym": "Alienated-Vitality-Genius",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xd881e372e1c11f0e2d5aa5bef8c3bea366f240cd",
      "pseudonym": "Agreeable-Skeleton",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xdc17961132cbe21a95be99287ae08e4a1681c4ab",
      "pseudonym": "Robust-Fox",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xdc5bb8ac24bcd21c782b0516d14bf239506be97f",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xdcff05be2ac3ee70a6d35a269e51faf46633eb22",
      "pseudonym": "Stunning-Tassel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xddddc9ee299d54a5b5f6e26ae30725523d9110ea",
      "pseudonym": "Musty-Mushroom-Developer",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xde0ac3cff22dc73ae9c8b9c14540bde8d36f004e",
      "pseudonym": "Huge-Pub",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xde0fa43faad1c0da4881c63681ad07a8c850a4e7",
      "pseudonym": "Paltry-Singing",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xde8768e8dda4d184e1e16f776ba57d62e13e001e",
      "pseudonym": "Fancy-Mouth-Grade",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xdec80e82b9496990947f6d069df90e0b13e0e97e",
      "pseudonym": "Second-Sleuth",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xdf014906724fd0e55ceba2139c33683c79776e6e",
      "pseudonym": "Shabby-Embryo",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe040ffe586e21cb49449e8daf19b1cdff87a824f",
      "pseudonym": "Cloudy-Injustice",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe05955daca9f7450022d453afbb8ad9b9a017e35",
      "pseudonym": "Wiggly-Comic-Zebra",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe0d1318aa06aa5119f3636351f34b88122d317fa",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe14915adc6dbc737fe3fdbacaa505ceb9b6b210a",
      "pseudonym": "Electric-Pinafore",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe151c40efc51cd79c1252c9164a1558a9a5aa8d5",
      "pseudonym": "Icy-Dream-Attacker",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe172f47a5954c24c96f03895eac7f63e29463f5b",
      "pseudonym": "Anchored-Rag",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe1de59189ee578b434625fe6a721c3e57509a5ab",
      "pseudonym": "Alarmed-Acrylic",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe2a7c4521924fe449dfbe41aae4ef90480694ada",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe2fe4ebc613239a2f57172748407353cc4c334aa",
      "pseudonym": "Forsaken-Few-Automaton",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe3ca44cd21547e90aeb5261e12ab89691d4ef5b0",
      "pseudonym": "Frightening-Strudel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe5a53449cc2afd8b3fe5bb17b2a48ae9e2f75737",
      "pseudonym": "Agitated-Sailboat",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe65b026b8d0ab0016dfb2590c14168bfe1990009",
      "pseudonym": "Worthy-Buffalo",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe7123a5454f9be0a197d5909d2720a4d473c9a10",
      "pseudonym": "Shy-Weird",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe7d8ddaba45ab8e867c69638bc76632a4fdf2cce",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe7e91d5d52b1524ddf6e83082d2d8b012a78fb3c",
      "pseudonym": "Low-Carrot",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe7fe243cedf4c0ae5a8d208c8508103c581e261e",
      "pseudonym": "Which-Handrail",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe948617b318dd5623fbbb583b0221d6be465a38f",
      "pseudonym": "Peaceful-Preserves",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe977b6270e1d6740117b4a56cc7595e4c9e4700f",
      "pseudonym": "False-Teammate",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xe9b1e78c0e5f3a6054fdeaeeee0a21ddf9b779d7",
      "pseudonym": "Concerned-Chef",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xeaeac70e7268982a05711ab0b0a63bbda74e673c",
      "pseudonym": "Alarming-Ego",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xeb07e775f08b2ed34cc51d801994aae56c145b0f",
      "pseudonym": "Loathsome-Volleyball",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xed2930d2be9d3d992cbd0acd6d0efca25d533024",
      "pseudonym": "Chilly-Brain",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xee3389ee357de2fba6ead899d3d3e5686a711e5c",
      "pseudonym": "Ample-Knuckle",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xeec7972f771467fa8eae5a908cbbcec23a5c2fa1",
      "pseudonym": "Blaring-Bust",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xeed534dcc5db47967ed834e5c8d7f77f9f796bb8",
      "pseudonym": "Those-Theme",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xef08ae4739e964a646d493da4aa1defbde73ca98",
      "pseudonym": "Ready-Reorganisation",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf015a9217a9f939d3d3a1c9cf7e14692eb461077",
      "pseudonym": "Untried-Widow-Majority",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf017347373f239973525616ebe3d39ad79684f1f",
      "pseudonym": "Positive-Wrong",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf09961b288647799928bc5d252d3cedfa816c6d1",
      "pseudonym": "Automatic-Alert",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf11c0db61cf08aa0af460abb6d4fd64c4abef8fa",
      "pseudonym": "Complicated-Lunchmeat",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf2950cf5fbbfcdaaf73268f2967c37b97a36667a",
      "pseudonym": "Delirious-Hatbox",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf3be9baec63c0e5c950fea8779a96f7f70577a17",
      "pseudonym": "Growling-Superiority-Clover",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf41d5c9b14254f98a1da48fcf1e8370f6efbbe3f",
      "pseudonym": "Snarling-Dome-Section",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf5286079ada8dcfeaa44f7f1c87e1ec37c127e5b",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf5490b09181b493441f4338574ac716d45c35a9d",
      "pseudonym": "Smug-Ringworm",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf5e7ae48c83678a992bb22aa0eab202d37e590e0",
      "pseudonym": "Needy-Carp-Spider",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf83a1260286d25ad8fc8d225afbd7d4096e495f6",
      "pseudonym": "Candid-Showstopper-Steak",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf87c7529fce35f2c74a06aeadb7b24ac67bfcfcb",
      "pseudonym": "Wiggly-Role",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf8b4c057cc47e7c77a5ea0a7aaf00fca914c34dc",
      "pseudonym": "Sour-Queen",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf962b99c9b89042c187a9609c5e0c0e8d5001b15",
      "pseudonym": "Alienated-Cannibal",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf9bd088b58ec58c492b3f054a6ed909fab9e57f5",
      "pseudonym": "Neat-Observatory-Turnover",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xf9e172942a2bd1ebe961abf9e322ee71cbd7421f",
      "pseudonym": "",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfa99822c8b1e84a29b0ddef3eefa914364b729af",
      "pseudonym": "Medium-Education",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfb5c08039ac3fde6bcc946bc1ac9823ab80ecda7",
      "pseudonym": "Overcooked-Function",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfb79d2053b50ac346438c643b27171ad266c74b0",
      "pseudonym": "Elated-Tonic",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfba78057c261d2f8d4499280d69559c11d333f64",
      "pseudonym": "Cluttered-Sectional",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfbd8c9c22ca76b3662d0e53a4f79719fdc684027",
      "pseudonym": "Admirable-Trust",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfd557e6db670c9704bc1d0d8e8b585c7d9c9f905",
      "pseudonym": "Necessary-Pentagon",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfd8e46519d0a8f9c35e5010ef4e7f56f7583aea4",
      "pseudonym": "Teeming-Precedence",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfda451488a8cd28752833b610bc82ff22c9c53c3",
      "pseudonym": "Hidden-Gavel",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfe4689892521a3b7cdbb25d45c69512936646133",
      "pseudonym": "Thorny-Acre-News",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    },
    {
      "wallet": "0xfe8a44919d6ea7e80e861e18e2b9e490adc779a9",
      "pseudonym": "Urban-Question",
      "reactionRate": 0,
      "per100": 0,
      "ahead": 0,
      "qualified": 16,
      "wilsonLower": 0,
      "eligible": false
    }
  ]
};

export default TRADER_REACTION_LEADERBOARD;
