/**
 * Sideload files served by this site.
 *
 * 0.3.0 is the Rust app in https://github.com/warthog-network/ledger-warthog.
 * The page refuses to install if a file hash differs from the pin below.
 *
 * These binaries are API level 27. Ledger maps that level to Nano S+ OS 1.7.0,
 * Nano X OS 2.8.0, Stax OS 1.11.0, Flex OS 1.7.0, and Apex P OS 1.2.0. Each
 * device has its own target id, so one file cannot be installed on the others.
 * The original Nano S is OS 2.1.0, target 0x31100004, and stays on the 0.2.0
 * file. Nano X is in the 0.3.0 GitHub release; Ledger OS rejects that sideload.
 * https://github.com/LedgerHQ/ledger-secure-sdk/blob/master/api_levels.json
 */
const REPO = "https://github.com/warthog-network/ledger-warthog";
const RELEASE_030 = `${REPO}/releases/tag/v0.3.0`;
const RELEASE_020 = `${REPO}/releases/tag/v0.2.0`;

export const LEDGER_REPO = REPO;

export const LEDGER_DEVICES = {
  nanosplus: {
    id: "nanosplus",
    name: "Warthog",
    version: "0.3.0",
    device: "Nano S+",
    os: "1.7.0",
    target: "nanos2",
    targetId: 0x33100004,
    apduPath: "/downloads/ledger/warthog-nanosplus-0.3.0.apdu",
    fileName: "warthog-nanosplus-0.3.0.apdu",
    apduSha256: "1baf42cc35b72094f968af9564ff3b627e2d6f151d3a739c6a72d43e67060c23",
    elfSha256: "aaa3f26018de4d470174b56e5fcc7bb5946b2125ce164887817c7c68c195353c",
    /** Digest the Ledger build wrote to warthog.sha256. It is not the .apdu file hash. */
    buildSha256File: "6f6567b7ac220e73f297284e372e28d6a172eb1e58fc8e3200b0459e0ba57f2a",
    releasePage: RELEASE_030,
    plug: "Plug in your Nano S+.",
    approve:
      "On a Nano S+, press the right button until the screen says Allow unsafe manager, then press both buttons. Both buttons on Deny unsafe manager reject the install.",
    note: "This file is Warthog 0.3.0 for Nano S+ OS 1.7.0 over a USB cable. It installs only on a Nano S+. The app source is the ledger-warthog repo.",
  },
  stax: {
    id: "stax",
    name: "Warthog",
    version: "0.3.0",
    device: "Stax",
    os: "1.11.0",
    target: "stax",
    targetId: 0x33200004,
    apduPath: "/downloads/ledger/warthog-stax-0.3.0.apdu",
    fileName: "warthog-stax-0.3.0.apdu",
    apduSha256: "6ac830788f5e9a78a697b36a3e3f1e98c2a3bac7cad60ef7af207649a010fcc5",
    elfSha256: "38a473d1b4c9e2fc9287deb12e2042456032bf1ab8497bfec2877c693eacbe37",
    buildSha256File: "f78bf3f9645794c247b72d6ca414bf93d0412a89bbab3b678178f40cde8c7bf6",
    releasePage: RELEASE_030,
    plug: "Plug in your Stax.",
    approve: "On a Stax, tap Allow unsafe manager.",
    note: "This file is Warthog 0.3.0 for Stax OS 1.11.0 over a USB cable. It installs only on a Stax. The app source is the ledger-warthog repo.",
  },
  flex: {
    id: "flex",
    name: "Warthog",
    version: "0.3.0",
    device: "Flex",
    os: "1.7.0",
    target: "flex",
    targetId: 0x33300004,
    apduPath: "/downloads/ledger/warthog-flex-0.3.0.apdu",
    fileName: "warthog-flex-0.3.0.apdu",
    apduSha256: "8c2d5909e87f039fe2eda78ddb1575aa55ed8d5e5b2a471cf42d4cbd468c3351",
    elfSha256: "c2767ad553983d8793727a0f30ad9720d232cfae6e5cd0b0eccf53a4372a51d3",
    buildSha256File: "3f00a50e353f7b5039175808c358a984474557609cef655e88480b649ba03224",
    releasePage: RELEASE_030,
    plug: "Plug in your Flex.",
    approve: "On a Flex, tap Allow unsafe manager.",
    note: "This file is Warthog 0.3.0 for Flex OS 1.7.0 over a USB cable. It installs only on a Flex. The app source is the ledger-warthog repo.",
  },
  apex_p: {
    id: "apex_p",
    name: "Warthog",
    version: "0.3.0",
    device: "Apex P",
    os: "1.2.0",
    target: "apex_p",
    targetId: 0x33400004,
    apduPath: "/downloads/ledger/warthog-apexp-0.3.0.apdu",
    fileName: "warthog-apexp-0.3.0.apdu",
    apduSha256: "d212a9c0330bbe5e9d8b2391b16a477d7b262c46fc98f193cfaf021f5d486939",
    elfSha256: "96752d62f60c1b7b24ee55bc9e62f1e68c106a24020aeab96fcedb678830a00e",
    buildSha256File: "3826229a01986dd83ce249d15d96481ccedf34a9648c78eb5e4f28c5f9df9683",
    releasePage: RELEASE_030,
    plug: "Plug in your Apex P.",
    approve: "On an Apex P, tap Allow unsafe manager.",
    note: "This file is Warthog 0.3.0 for Apex P OS 1.2.0 over a USB cable. It installs only on an Apex P. The app source is the ledger-warthog repo.",
  },
  nanos: {
    id: "nanos",
    name: "Warthog",
    version: "0.2.0",
    device: "Nano S",
    os: "2.1.0",
    target: "nanos",
    targetId: 0x31100004,
    apduPath: "/downloads/ledger/warthog-nanos-0.2.0.apdu",
    fileName: "warthog-nanos-0.2.0.apdu",
    apduSha256: "8d8b7c24df6730b947b10a9988c476a452c0fb8a7fd3fab9069714a49145f77e",
    elfSha256: "8fd992cc1fcfe450b37b5204d3018fd34793072bbb08978633c50418b35598bc",
    buildSha256File: "5583da409ab8010e0546d0f4f993e8e58220f993b53859ec2aa941d5827bac4d",
    releasePage: RELEASE_020,
    plug: "Plug in your Nano S.",
    approve:
      "On a Nano S, press the right button until the screen says Allow unsafe manager, then press both buttons. Both buttons on Deny unsafe manager reject the install.",
    note: "This file is Warthog 0.2.0 for the original Nano S, OS 2.1.0, over a USB cable. The 0.3.0 Rust app has no Nano S build, so this page still serves the v0.2.0 file from the same repo. The eight review rows are paged with the two buttons on the 128×32 screen.",
  },
};

/** Nano S+ entry. Kept so existing imports still point at that file. */
export const LEDGER_RELEASE = LEDGER_DEVICES.nanosplus;
