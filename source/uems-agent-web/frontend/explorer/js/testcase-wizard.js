// ── Testcase Generator Wizard ─────────────────────────────────
// Renders a structured input form in the empty-state greeting when
// the Testcase Generator agent is selected.  Collects:
//   • Functionality name
//   • Mode (Diff comparison | Functionality-level)
//   • Conditional fields based on mode
//   • Platform
// On submit it builds a structured prompt and fires 'chat:send-prompt'.

import { escapeHtml } from './utils.js';

// ── Repository list derived from repos.json ───────────────────
// Grouped by platform for the datalist
const REPOS = {
  windows: [
    'uems_win_agent_setup',
    'uems_agent_framework',
    'uems_agent_utils',
    'agent-framework',
    'vmdr_agent',
    'uems_ds',
    'uems_configurations',
    'inventory_mgmt',
    'uems_tools',
    'uems_agent_internal',
    'uems_agent_healthchecker',
    'secure_usb_configuration',
    'vmdr_quarantine_compliance',
    'ea-base-agent',
    'endpoint-analytics-agent',
    'release_agent',
  ],
  mac: [
    'uems-mac-agent-setup',
    'agent-utils',
    'configuration-framework',
    'framework-ops-suite',
    'patch-management',
    'inventory-management',
    'config-sd',
    'uems_mac_agent_ra',
    'application-control',
    'browser-security',
    'device-control-plus',
    'ea-base-mac-agent',
  ],
  linux: [
    'dc_native',
  ],
  'cross-platform': [
    'uems_go_components',
    'uems_native_dependencies',
    'experience-agent',
    'workflow-agent',
    'sensor-agent',
  ],
};

/** Build the datalist options for the selected platform. */
function buildRepoOptions(platform) {
  const list = REPOS[platform] || [];
  const cross = REPOS['cross-platform'];
  const combined = [...list, ...cross];
  return combined.map((r) => `<option value="${escapeHtml(r)}">`).join('');
}

/** Build the full wizard HTML. */
function buildWizardHTML(name) {
  return `
<div class="tc-wizard" id="tc-wizard">
  <div class="tc-wizard-header">
    <span class="material-symbols-rounded tc-wizard-icon">checklist</span>
    <div>
      <h2 class="tc-wizard-title">Generate Test Cases</h2>
      <p class="tc-wizard-subtitle">Hello, ${escapeHtml(name)}. Fill in the details below to start generating test cases.</p>
    </div>
  </div>

  <form class="tc-wizard-form" id="tc-wizard-form" novalidate>

    <!-- Functionality Name -->
    <div class="tc-field">
      <label class="tc-label" for="tc-func-name">
        Functionality Name <span class="tc-required">*</span>
      </label>
      <input
        type="text"
        id="tc-func-name"
        class="tc-input"
        placeholder="e.g. Agent Installation, Computer Rename, Software Deployment"
        autocomplete="off"
        required
      >
      <div class="tc-field-hint">The feature or module to generate test cases for.</div>
    </div>

    <!-- Mode -->
    <div class="tc-field">
      <label class="tc-label">Generation Mode <span class="tc-required">*</span></label>
      <div class="tc-mode-cards">
        <label class="tc-mode-card" id="tc-mode-func-card">
          <input type="radio" name="tc-mode" value="functionality" checked>
          <div class="tc-mode-card-body">
            <span class="material-symbols-rounded tc-mode-icon">article</span>
            <div>
              <strong>Functionality-level</strong>
              <p>Generate comprehensive test cases for a feature or module from scratch (or extend existing coverage).</p>
            </div>
          </div>
        </label>
        <label class="tc-mode-card" id="tc-mode-diff-card">
          <input type="radio" name="tc-mode" value="diff">
          <div class="tc-mode-card-body">
            <span class="material-symbols-rounded tc-mode-icon">difference</span>
            <div>
              <strong>Diff Comparison</strong>
              <p>Generate test cases based on what changed between two branches — targeted coverage for code changes.</p>
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- Functionality-level: repo only -->
    <div class="tc-mode-section" id="tc-section-func">
      <div class="tc-field">
        <label class="tc-label" for="tc-func-repo">
          Repository <span class="tc-required">*</span>
        </label>
        <input
          type="text"
          id="tc-func-repo"
          class="tc-input"
          list="tc-repo-list-func"
          placeholder="e.g. uems_win_agent_setup"
          autocomplete="off"
        >
        <datalist id="tc-repo-list-func"></datalist>
        <div class="tc-field-hint">The repository where the functionality code lives. The agent will read this repo to ground the test cases in real code.</div>
      </div>
    </div>

    <!-- Diff comparison: branches + repo -->
    <div class="tc-mode-section hidden" id="tc-section-diff">
      <div class="tc-field-row">
        <div class="tc-field">
          <label class="tc-label" for="tc-src-branch">
            Source Branch <span class="tc-required">*</span>
          </label>
          <input
            type="text"
            id="tc-src-branch"
            class="tc-input"
            placeholder="e.g. feature_win_agent_26.05"
            autocomplete="off"
          >
          <div class="tc-field-hint">The feature/fix branch (newer code).</div>
        </div>
        <div class="tc-field">
          <label class="tc-label" for="tc-tgt-branch">
            Target Branch <span class="tc-required">*</span>
          </label>
          <input
            type="text"
            id="tc-tgt-branch"
            class="tc-input"
            placeholder="e.g. main"
            autocomplete="off"
          >
          <div class="tc-field-hint">The base branch (e.g. main, release tag).</div>
        </div>
      </div>
      <div class="tc-field">
        <label class="tc-label" for="tc-diff-repo">
          Repository <span class="tc-required">*</span>
        </label>
        <input
          type="text"
          id="tc-diff-repo"
          class="tc-input"
          list="tc-repo-list-diff"
          placeholder="e.g. uems_win_agent_setup"
          autocomplete="off"
        >
        <datalist id="tc-repo-list-diff"></datalist>
        <div class="tc-field-hint">The repository that contains the changed code. The agent will fetch the diff from this repo.</div>
      </div>
    </div>

    <!-- Platform -->
    <div class="tc-field">
      <label class="tc-label">Platform <span class="tc-required">*</span></label>
      <div class="tc-platform-pills">
        <label class="tc-platform-pill">
          <input type="radio" name="tc-platform" value="windows" checked>
          <span class="material-symbols-rounded">desktop_windows</span>
          Windows
        </label>
        <label class="tc-platform-pill">
          <input type="radio" name="tc-platform" value="mac">
          <span class="material-symbols-rounded">desktop_mac</span>
          macOS
        </label>
        <label class="tc-platform-pill">
          <input type="radio" name="tc-platform" value="linux">
          <span class="material-symbols-rounded">terminal</span>
          Linux
        </label>
      </div>
    </div>

    <!-- Error message -->
    <div class="tc-error hidden" id="tc-error"></div>

    <!-- Submit -->
    <button type="submit" class="tc-submit-btn" id="tc-submit">
      <span class="material-symbols-rounded">send</span>
      Generate Test Cases
    </button>
  </form>
</div>`;
}

/** Build the structured prompt from form values. */
function buildPrompt(data) {
  if (data.mode === 'diff') {
    return [
      `Generate test cases for the following:`,
      `- Functionality: ${data.functionality}`,
      `- Mode: Diff comparison`,
      `- Source branch: ${data.sourceBranch}`,
      `- Target branch: ${data.targetBranch}`,
      `- Repository: ${data.repository}`,
      `- Platform: ${data.platform}`,
    ].join('\n');
  }
  return [
    `Generate test cases for the following:`,
    `- Functionality: ${data.functionality}`,
    `- Mode: Functionality-level`,
    `- Repository: ${data.repository}`,
    `- Platform: ${data.platform}`,
  ].join('\n');
}

/** Populate datalists when platform changes. */
function refreshDatalist(platform) {
  const allRepos = [...(REPOS[platform] || []), ...REPOS['cross-platform']];
  const optHtml = allRepos.map((r) => `<option value="${escapeHtml(r)}">`).join('');
  document.getElementById('tc-repo-list-func').innerHTML = optHtml;
  document.getElementById('tc-repo-list-diff').innerHTML = optHtml;
}

/** Wire all form interactions. Called once after the wizard is in the DOM. */
function bindWizard(chatInput) {
  const form       = document.getElementById('tc-wizard-form');
  const secFunc    = document.getElementById('tc-section-func');
  const secDiff    = document.getElementById('tc-section-diff');
  const errorBox   = document.getElementById('tc-error');

  if (!form) return;

  // Mode radio → show/hide conditional sections
  form.querySelectorAll('input[name="tc-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isDiff = radio.value === 'diff';
      secFunc.classList.toggle('hidden', isDiff);
      secDiff.classList.toggle('hidden', !isDiff);

      // Update mode card selected styling
      document.getElementById('tc-mode-func-card').classList.toggle('selected', !isDiff);
      document.getElementById('tc-mode-diff-card').classList.toggle('selected', isDiff);
    });
    // Set initial selected state
    if (radio.checked) {
      const isDiff = radio.value === 'diff';
      document.getElementById('tc-mode-func-card').classList.toggle('selected', !isDiff);
      document.getElementById('tc-mode-diff-card').classList.toggle('selected', isDiff);
    }
  });

  // Platform radio → refresh repo datalists
  form.querySelectorAll('input[name="tc-platform"]').forEach((radio) => {
    radio.addEventListener('change', () => refreshDatalist(radio.value));
    if (radio.checked) refreshDatalist(radio.value);
  });

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    errorBox.classList.add('hidden');

    const functionality = document.getElementById('tc-func-name').value.trim();
    const mode          = form.querySelector('input[name="tc-mode"]:checked')?.value;
    const platform      = form.querySelector('input[name="tc-platform"]:checked')?.value || 'windows';

    // Validate
    const errors = [];
    if (!functionality) errors.push('Functionality name is required.');

    let repository = '';
    let sourceBranch = '';
    let targetBranch = '';

    if (mode === 'diff') {
      sourceBranch = document.getElementById('tc-src-branch').value.trim();
      targetBranch = document.getElementById('tc-tgt-branch').value.trim();
      repository   = document.getElementById('tc-diff-repo').value.trim();
      if (!sourceBranch) errors.push('Source branch is required.');
      if (!targetBranch) errors.push('Target branch is required.');
      if (!repository)   errors.push('Repository is required.');
    } else {
      repository = document.getElementById('tc-func-repo').value.trim();
      if (!repository) errors.push('Repository is required.');
    }

    if (errors.length > 0) {
      errorBox.textContent = errors.join(' ');
      errorBox.classList.remove('hidden');
      return;
    }

    const prompt = buildPrompt({ functionality, mode, sourceBranch, targetBranch, repository, platform });
    chatInput.value = prompt;
    chatInput.focus();
    window.dispatchEvent(new CustomEvent('chat:send-prompt')); //No I18N
  });

  // Set initial selected card styling
  document.getElementById('tc-mode-func-card').classList.add('selected');
}

/** Public: render the wizard into chatContainer. */
export function renderTestcaseWizard(chatContainer, userName, chatInput) {
  chatContainer.className = 'chat-container is-empty';
  chatContainer.innerHTML = buildWizardHTML(userName || 'there');
  bindWizard(chatInput);
}
