/**
 * Sideload files for ledger-warthog 0.2.0.
 * The page refuses to install if a file hash differs.
 *
 * The Nano S+ binary is API level 27 (ledger-secure-sdk). Ledger maps that
 * level to Nano S+ OS 1.7.0, Nano X OS 2.8.0, Stax OS 1.11.0, Flex OS 1.7.0,
 * and Apex P OS 1.2.0. Each device still has its own target id, so one file
 * cannot be installed on the others. The original Nano S is OS 2.1.0,
 * target 0x31100004, and uses its own file.
 * https://github.com/LedgerHQ/ledger-secure-sdk/blob/master/api_levels.json
 */
const RELEASE_PAGE = "https://github.com/warthog-network/ledger-warthog/releases/tag/v0.2.0";

export const LEDGER_DEVICES = {
  nanosplus: {
    id: "nanosplus",
    name: "Warthog",
    version: "0.2.0",
    device: "Nano S+",
    os: "1.7.0",
    target: "nanos2",
    targetId: 0x33100004,
    apduPath: "/downloads/ledger/warthog-nanosplus-0.2.0.apdu",
    fileName: "warthog-nanosplus-0.2.0.apdu",
    apduSha256: "1f9ed6cdd29d46afce08eaf1b111a70dedb1624b4af72aec9b789546b8c99074",
    elfSha256: "9ec0c84d215f721184b2c428cb90d414515036ae67fa1852a7eac7525abd6cbf",
    /** Digest the Ledger build wrote to app.sha256. It is not the .apdu file hash. */
    buildSha256File: "83ff349eba098accb1a27705317d0788a70c18c2587f43aa8989fe9f9af1a6b9",
    releasePage: RELEASE_PAGE,
    plug: "Plug in your Nano S+.",
    approve: "On a Nano S+, press both buttons at the same time.",
    note: "This file is for Nano S+ OS 1.7.0, over a USB cable. Today this works on a Nano S and a Nano S+. Bluetooth models (Nano X, Stax, Flex, and Nano Gen5) do not work yet. Bluetooth support is in the works.",
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
    releasePage: "",
    plug: "Plug in your Nano S.",
    approve: "On a Nano S, press both buttons at the same time.",
    note: "This file is the original Nano S build for OS 2.1.0, over a USB cable. The eight review rows are paged with the two buttons on the 128×32 screen. The dashboard icon is 16×16. Bluetooth models (Nano X, Stax, Flex, and Nano Gen5) do not work yet. Bluetooth support is in the works.",
  },
};

/** Nano S+ entry. Kept so existing imports still point at that file. */
export const LEDGER_RELEASE = LEDGER_DEVICES.nanosplus;
