(() => {
  const bootModes = {
    uefi: [
      {
        id: "power",
        short: "Power",
        title: "1. Power-On and Electrical Stabilization",
        summary: "Power rails settle, clock domains lock, and reset lines ensure deterministic CPU startup state.",
        purpose: "This stage prevents undefined logic behavior by enforcing a stable electrical base before code execution.",
        theory: [
          "PSU and VRM sequencing must assert power-good before reset release.",
          "The CPU starts from a known reset vector only after stable clocks.",
          "Without clean power gating, random faults appear before firmware runs."
        ],
        failure: "No display, no beep, or instant power cycling often points to rail or reset-sequence issues.",
        contract: "Hardware guarantees voltage and timing integrity so firmware can assume a valid execution baseline."
      },
      {
        id: "firmware",
        short: "UEFI",
        title: "2. Firmware Entry and UEFI Pre-Boot Services",
        summary: "The CPU enters UEFI firmware in SPI flash, initializing early platform interfaces and memory context.",
        purpose: "UEFI builds a structured environment so the boot manager can discover devices and apply policy.",
        theory: [
          "PEI establishes temporary memory and platform handoff blocks.",
          "DXE drivers initialize buses and expose boot services.",
          "NVRAM variables hold boot targets and policy configuration."
        ],
        failure: "Firmware corruption or NVRAM inconsistency can cause hangs before any OS logo appears.",
        contract: "Firmware hands future stages a device model, memory map, and boot-service APIs."
      },
      {
        id: "post",
        short: "POST",
        title: "3. POST and Hardware Enumeration",
        summary: "Firmware validates CPU, RAM, and buses, then enumerates storage and I/O devices needed for boot.",
        purpose: "POST narrows risk by proving the machine can safely continue into executable loading.",
        theory: [
          "DRAM training calibrates timing and signal integrity.",
          "PCIe, NVMe, SATA, and USB controllers are probed for boot candidates.",
          "Diagnostic codes localize failures before OS launch."
        ],
        failure: "Memory faults and bus initialization failures frequently stop progress at this phase.",
        contract: "Firmware guarantees device visibility and validated memory for the boot manager."
      },
      {
        id: "bootmgr",
        short: "Manager",
        title: "4. UEFI Boot Manager Selection",
        summary: "UEFI evaluates Boot#### entries, applies secure boot policy, and picks a signed EFI loader.",
        purpose: "This stage converts platform policy into a concrete executable boot target.",
        theory: [
          "Boot order is controlled through persistent NVRAM entries.",
          "Secure Boot checks signatures against trusted key databases.",
          "Fallback paths may route to recovery or alternate loaders."
        ],
        failure: "Missing boot entries or signature rejection can block startup despite healthy hardware.",
        contract: "The selected loader receives trusted execution context and filesystem access."
      },
      {
        id: "bootloader",
        short: "Loader",
        title: "5. EFI Bootloader and Kernel Image Preparation",
        summary: "The bootloader loads kernel and initramfs into RAM, then prepares kernel arguments and memory descriptors.",
        purpose: "It translates storage artifacts into an executable kernel handoff contract.",
        theory: [
          "Loaders like GRUB/systemd-boot parse config and menu policy.",
          "Initramfs carries early userspace tools and storage drivers.",
          "Kernel command line controls rootfs and boot-time behavior."
        ],
        failure: "Wrong kernel parameters or missing initramfs modules often cause early panic.",
        contract: "Kernel expects architecture mode, memory map, and boot params to be valid."
      },
      {
        id: "kernel",
        short: "Kernel",
        title: "6. Kernel Early Initialization",
        summary: "Kernel enables MMU, interrupt handling, scheduling, and core drivers before mounting root filesystem.",
        purpose: "This is where the OS takes ownership of hardware from firmware/bootloader control.",
        theory: [
          "Page tables and exception vectors establish memory protection.",
          "Driver probing discovers real boot disk and buses.",
          "PID 1 launch marks transition toward normal userspace lifecycle."
        ],
        failure: "Kernel panic, rootfs mount errors, or stalled driver initialization happen here.",
        contract: "Kernel relies on a correct hardware description and accessible boot media."
      },
      {
        id: "userspace",
        short: "Userspace",
        title: "7. Init System and User Space Activation",
        summary: "The init system starts services, networking, and login targets until the machine is usable.",
        purpose: "This stage turns a booted kernel into a functioning operating environment.",
        theory: [
          "Service dependency graphs define startup critical path.",
          "Display manager and login stack create interactive sessions.",
          "Most slow boots here are service-level, not kernel-level, bottlenecks."
        ],
        failure: "Black screen with blinking cursor or service timeouts usually indicate userspace startup failures.",
        contract: "Userspace expects stable kernel APIs, mounted filesystems, and working device nodes."
      }
    ],
    bios: [
      {
        id: "power",
        short: "Power",
        title: "1. Power-On and Electrical Stabilization",
        summary: "Power rails settle and reset logic holds CPU until clocks and voltages are stable.",
        purpose: "Same physical requirement as modern systems: no deterministic startup without stable rails.",
        theory: [
          "Power-good and reset timing are strict hardware contracts.",
          "CPU starts from legacy reset vector after deassertion.",
          "Clock lock ensures synchronous logic can execute valid instructions."
        ],
        failure: "If unstable, system may not reach firmware splash or beep codes.",
        contract: "Hardware baseline guarantees the firmware can begin execution."
      },
      {
        id: "firmware",
        short: "BIOS",
        title: "2. Legacy BIOS Firmware Entry",
        summary: "CPU enters BIOS routines in real mode, beginning hardware setup with legacy conventions.",
        purpose: "BIOS provides minimal initialization and interrupt-based access for boot code.",
        theory: [
          "Legacy BIOS executes 16-bit routines and compatibility flows.",
          "CMOS settings drive boot order and device preferences.",
          "Interrupt services abstract low-level disk and display access."
        ],
        failure: "Corrupt ROM or unsupported hardware can block POST completion.",
        contract: "BIOS establishes enough device access for MBR bootstrapping."
      },
      {
        id: "post",
        short: "POST",
        title: "3. POST and Legacy Hardware Checks",
        summary: "BIOS validates essential components and detects storage controllers and bootable devices.",
        purpose: "Prevents attempting boot when critical hardware is not operational.",
        theory: [
          "Memory counting/training and adapter checks happen here.",
          "BIOS may emit beep sequences on fatal errors.",
          "Detected disks become candidates for boot sector reads."
        ],
        failure: "POST code hangs or repeated beep sequences indicate failing hardware tests.",
        contract: "By stage end, BIOS promises boot media can be read at sector level."
      },
      {
        id: "bootmgr",
        short: "Boot Order",
        title: "4. Legacy Boot Device Resolution",
        summary: "BIOS checks boot order and reads the selected device's master boot record (MBR).",
        purpose: "Selects one physical device and transfers control to first-stage boot code in sector 0.",
        theory: [
          "Boot order is usually HDD, optical, removable, then network.",
          "MBR contains tiny bootstrap code and partition metadata.",
          "No native secure boot trust chain in traditional BIOS flow."
        ],
        failure: "Messages like 'No bootable device' usually originate at this boundary.",
        contract: "BIOS hands control to 440-byte bootstrap region under legacy assumptions."
      },
      {
        id: "bootloader",
        short: "Loader",
        title: "5. Stage-1/Stage-2 Bootloader Execution",
        summary: "Initial MBR loader finds larger stage-two loader, then loads kernel and early system image.",
        purpose: "Extends tiny first-stage logic into full loader behavior with filesystem awareness.",
        theory: [
          "First-stage code is too small for complex filesystem logic.",
          "Second-stage loader builds kernel params and memory layout.",
          "Multi-boot menus are usually implemented at this level."
        ],
        failure: "Broken boot sectors or missing stage-two files cause early loader prompt errors.",
        contract: "Loader must place kernel in expected memory and jump with correct CPU state."
      },
      {
        id: "kernel",
        short: "Kernel",
        title: "6. Kernel Bring-Up and Root Filesystem Mount",
        summary: "Kernel initializes memory management, interrupts, and drivers, then mounts root filesystem.",
        purpose: "Transitions control from firmware-era conventions to OS-native execution.",
        theory: [
          "Protected mode / long mode transitions are architecture critical.",
          "Early driver availability determines storage/network reachability.",
          "PID 1 start marks completion of kernel-only setup."
        ],
        failure: "Kernel panic and root mount failures are common if loader params are wrong.",
        contract: "Kernel needs valid boot args and working hardware mappings from prior stages."
      },
      {
        id: "userspace",
        short: "Userspace",
        title: "7. Init and Service Startup",
        summary: "Init system launches services and sessions until the system reaches operational target state.",
        purpose: "Makes the machine usable to users and applications.",
        theory: [
          "Init scripts or service managers coordinate startup order.",
          "Login subsystem creates the user interaction boundary.",
          "Startup latency often comes from slow service dependencies."
        ],
        failure: "System may boot kernel but fail to provide login/session if userspace services break.",
        contract: "Userspace assumes kernel and storage stack are stable and ready."
      }
    ]
  };

  const historyEvents = [
    { year: "1981", title: "IBM PC BIOS Era", text: "BIOS-based startup became mainstream, using MBR boot sectors and 16-bit real mode routines." },
    { year: "1990s", title: "POST and Plug-and-Play Matures", text: "Firmware started handling broader hardware detection and dynamic resource assignment." },
    { year: "2005+", title: "UEFI Replaces BIOS in New Platforms", text: "Structured pre-boot services and GPT support removed many legacy BIOS limits." },
    { year: "2012+", title: "Secure Boot Adoption", text: "Signature validation turned boot into a stronger trust chain against pre-OS malware." },
    { year: "Today", title: "Measured and Attested Boot", text: "Enterprise systems increasingly integrate TPM-backed measurement and policy attestation." }
  ];

  const compareData = {
    uefi: [
      "Native GPT support and large disk compatibility.",
      "Rich boot manager with NVRAM-configured entries.",
      "Secure Boot trust chain with signature enforcement.",
      "Modular firmware drivers and standardized boot services.",
      "Faster/cleaner transition into 64-bit OS startup paths."
    ],
    bios: [
      "Relies on MBR and legacy partitioning limits.",
      "Bootstraps from tiny first-sector code (stage-1 loader).",
      "Minimal built-in security at boot boundary.",
      "16-bit legacy conventions and interrupt services.",
      "Compatible with older operating systems and hardware flows."
    ]
  };

  const labCases = [
    { symptom: "System powers on, then shuts off after 2 seconds", stageId: "power", diagnosis: "Power sequencing instability or VRM/power-good assertion failure is likely." },
    { symptom: "Boot logo appears, then freezes before OS loader", stageId: "post", diagnosis: "POST device initialization likely failed, often due to RAM or bus-level issues." },
    { symptom: "Error says 'No bootable device found'", stageId: "bootmgr", diagnosis: "Boot target resolution failed due to wrong order, missing entry, or unreadable boot media." },
    { symptom: "Kernel panic right after loader handoff", stageId: "kernel", diagnosis: "Kernel init contract likely broken by wrong parameters, missing initramfs content, or rootfs path errors." },
    { symptom: "Kernel boots but login screen never appears", stageId: "userspace", diagnosis: "Init/service graph likely failed; inspect userspace startup logs and target dependencies." }
  ];

  const stageTabs = document.getElementById("stageTabs");
  const stageTitle = document.getElementById("stageTitle");
  const stageSummary = document.getElementById("stageSummary");
  const stagePurpose = document.getElementById("stagePurpose");
  const stageTheory = document.getElementById("stageTheory");
  const stageFailure = document.getElementById("stageFailure");
  const stageContract = document.getElementById("stageContract");
  const historyTrack = document.getElementById("historyTrack");
  const uefiList = document.getElementById("uefiList");
  const biosList = document.getElementById("biosList");
  const labButtons = document.getElementById("labButtons");
  const labResult = document.getElementById("labResult");
  const modeUefiBtn = document.getElementById("modeUefiBtn");
  const modeBiosBtn = document.getElementById("modeBiosBtn");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  function setupHoverAutoplayVideos() {
    const videos = document.querySelectorAll(".hover-autoplay-video");
    videos.forEach((video) => {
      video.addEventListener("mouseenter", () => {
        video.muted = true;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      });

      video.addEventListener("mouseleave", () => {
        video.pause();
        video.currentTime = 0;
      });
    });
  }

  setupHoverAutoplayVideos();

  if (!stageTabs || !stageTitle) {
    return;
  }

  let activeMode = "uefi";
  let activeStage = 0;

  function stages() {
    return bootModes[activeMode];
  }

  function renderTabs() {
    stageTabs.innerHTML = "";
    stages().forEach((stage, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-tab";
      button.setAttribute("role", "tab");
      button.textContent = `${index + 1}. ${stage.short}`;
      button.addEventListener("click", () => setStage(index));
      stageTabs.appendChild(button);
    });
  }

  function renderStageContent() {
    const stage = stages()[activeStage];
    stageTitle.textContent = stage.title;
    stageSummary.textContent = stage.summary;
    stagePurpose.textContent = stage.purpose;
    stageFailure.textContent = stage.failure;
    stageContract.textContent = stage.contract;
    stageTheory.innerHTML = "";

    stage.theory.forEach((point) => {
      const card = document.createElement("div");
      card.className = "theory-card";
      card.textContent = point;
      stageTheory.appendChild(card);
    });

    stageTabs.querySelectorAll(".stage-tab").forEach((button, idx) => {
      const active = idx === activeStage;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function renderHistory() {
    historyTrack.innerHTML = "";
    historyEvents.forEach((item) => {
      const article = document.createElement("article");
      article.className = "history-item";
      article.innerHTML = `<div class="history-year">${item.year}</div><div><h3>${item.title}</h3><p>${item.text}</p></div>`;
      historyTrack.appendChild(article);
    });
  }

  function renderCompare() {
    uefiList.innerHTML = "";
    biosList.innerHTML = "";
    compareData.uefi.forEach((point) => {
      const li = document.createElement("li");
      li.textContent = point;
      uefiList.appendChild(li);
    });
    compareData.bios.forEach((point) => {
      const li = document.createElement("li");
      li.textContent = point;
      biosList.appendChild(li);
    });
  }

  function renderLab() {
    labButtons.innerHTML = "";
    labCases.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lab-btn";
      button.innerHTML = `<strong>Case ${index + 1}</strong><p>${item.symptom}</p>`;
      button.addEventListener("click", () => {
        const idx = stages().findIndex((stage) => stage.id === item.stageId);
        if (idx >= 0) {
          setStage(idx);
        }
        labResult.innerHTML = `<h3>Most likely failing boundary: ${item.stageId.toUpperCase()}</h3><p>${item.diagnosis}</p>`;
      });
      labButtons.appendChild(button);
    });
    labResult.innerHTML = "<h3>Choose a case</h3><p>Select any symptom to map it to the most likely stage boundary.</p>";
  }

  function setMode(mode) {
    if (!bootModes[mode]) {
      return;
    }
    activeMode = mode;
    activeStage = 0;
    modeUefiBtn.classList.toggle("active", mode === "uefi");
    modeBiosBtn.classList.toggle("active", mode === "bios");
    renderTabs();
    renderStageContent();
    renderLab();
  }

  function setStage(index) {
    const total = stages().length;
    activeStage = (index + total) % total;
    renderStageContent();
  }

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const open = mainNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(open));
    });
    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  modeUefiBtn.addEventListener("click", () => setMode("uefi"));
  modeBiosBtn.addEventListener("click", () => setMode("bios"));

  renderHistory();
  renderCompare();
  renderTabs();
  renderStageContent();
  renderLab();
})();
