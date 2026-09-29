import { message } from "./shared.js";
import { getService } from "./socket-handler.js";

/** Native DOM presentation for refreshRecipients; no audio or persistence writes. */
export function refreshRecipients(pad) {
    const root = pad.element?.querySelector?.(".chris-sound-soundpad");
    if (!root?.querySelectorAll)
        return;
    const find = selector => root.querySelector(selector);
    const all = selector => root.querySelectorAll?.(selector) ?? [];
    const isOpen = pad.panels.has("targets");
    const toggle = find(".csm-recipient-toggle"), panel = find(".csm-target-body");
    if (toggle)
        toggle.setAttribute("aria-expanded", String(isOpen));
    if (panel)
        panel.hidden = !isOpen;
    for (const summary of all(".csm-target-summary"))
        summary.textContent = pad.targetSummary();
    // A stored group can reference a removed User. Keep that recipient deselectable.
    const list = find(".recipient-list");
    if (list?.ownerDocument) {
        const existing = new Set([...all('[data-field="target"]')].map(input => input.value));
        for (const id of pad.targetIds) {
            if (existing.has(id))
                continue;
            const doc = list.ownerDocument, label = doc.createElement("label"), input = doc.createElement("input"), text = doc.createElement("span");
            label.className = "csm-check";
            label.dataset.missingUser = id;
            input.type = "checkbox";
            input.dataset.field = "target";
            input.value = id;
            input.id = `soundpad-recipient-${id}`;
            input.name = `csm-recipient-${id}`;
            label.htmlFor = input.id;
            text.textContent = pad.targetSummary([id]);
            label.append(input, text);
            list.append(label);
        }
        for (const label of list.querySelectorAll("[data-missing-user]")) {
            // Keep the node through its native change event; remove it on a later render.
            const input = label.querySelector("input");
            input.disabled = !game.users.get(input.value) && !pad.targetIds.includes(input.value);
        }
    }
    for (const input of all('[data-field="target"]'))
        input.checked = pad.targetIds.includes(input.value);
    const groupSelect = find('[data-field="group"]');
    if (groupSelect)
        groupSelect.value = pad.groupId;
    const group = pad.data?.groups.find(entry => entry.id === (pad.groupId || pad.groupEditId));
    const name = find('[data-field="groupName"]');
    // Do not replace an in-progress group-name edit when recipients change.
    if (name)
        name.value = pad.groupNameDraft ?? group?.name ?? "";
    for (const label of all(".csm-group-edit-name"))
        label.textContent = group?.name ?? "";
    const update = find('[data-action="updateGroup"]'), remove = find('[data-action="deleteGroup"]');
    if (update)
        update.hidden = !Boolean(pad.groupEditId && !pad.groupId && group);
    if (remove)
        remove.hidden = !Boolean(group);
    const hasTargets = pad.targetIds.length > 0;
    for (const action of ["stopSound", "clearTargets", "applyVolume"]) {
        const button = find(`[data-action="${action}"]`);
        if (button)
            button.disabled = !hasTargets;
    }
    const play = find('[data-action="playSound"]');
    if (play)
        play.disabled = !Boolean(pad.selected && hasTargets);
    pad.renderStatus();
}

/** Native DOM presentation for targetSummary; no audio or persistence writes. */
export function targetSummary(pad, ids = pad.targetIds) {
    return ids.map(id => {
        const user = game.users.get(id);
        return `${user?.name ?? id}${user?.active ? "" : ` (${message("Status.offline")})`}`;
    }).join(", ") || message("UI.NoTargets");
}

/** Native DOM presentation for renderStatus; no audio or persistence writes. */
export function renderStatus(pad) {
    const root = pad.element?.querySelector?.(".recipient-status");
    if (!root)
        return;
    const document = root.ownerDocument ?? globalThis.document;
    const rows = getService().tracker.rows();
    const textFor = row => {
        const clients = Object.values(row.clients);
        const details = clients.length ? clients.map(client => `${message(`Status.${client.status}`)}${client.muted || client.factor === 0 ? ` (${message("UI.PersonallyMuted")})` : ""}${client.code ? `: ${message(`Error.${client.code}`)}` : ""}`).join(" / ") : message(`Status.${row.status}`);
        const count = clients.length > 1 ? ` (${message("UI.ClientCount", { count: clients.length })})` : "";
        const level = Number.isFinite(row.volume) ? ` · ${message("UI.RequestedVolume")}: ${Math.round(foundry.audio.AudioHelper.volumeToInput(row.volume) * 100)}%` : "";
        return `${game.users.get(row.userId)?.name ?? row.userId}${count}: ${row.label || message("UI.UnknownSound")} · ${details}${level}`;
    };
    root.replaceChildren();
    const counts = new Map();
    for (const row of rows) {
        counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        const line = document.createElement("div");
        line.textContent = textFor(row);
        root.append(line);
    }
    const summary = [...counts].map(([status, count]) => `${count} ${message(`Status.${status}`)}`).join(", ") || message("UI.NoStatus");
    const summaryNode = pad.element.querySelector(".csm-status-summary");
    if (summaryNode)
        summaryNode.textContent = summary;
    else {
        const node = document.createElement("strong");
        node.textContent = summary;
        root.prepend(node);
    }
    const live = pad.element.querySelector(".csm-live-reports");
    if (live) {
        live.replaceChildren();
        for (const id of pad.targetIds) {
            const row = rows.find(row => row.userId === id), line = document.createElement("div");
            line.textContent = row ? textFor(row) : `${game.users.get(id)?.name ?? id}: ${message("UI.NoPlaybackReport")}`;
            live.append(line);
        }
        if (!pad.targetIds.length)
            live.textContent = message("UI.NoTargets");
    }
    const warnings = pad.element.querySelector(".csm-status-warnings");
    if (warnings) {
        warnings.textContent = rows.filter(row => ["error", "offline", "unknown", "noResponse", "mixed"].includes(row.status))
            .map(row => `${game.users.get(row.userId)?.name ?? row.userId}: ${message(`Status.${row.status}`)}`).join(", ");
        warnings.hidden = !warnings.textContent;
    }
    const service = getService();
    const preview = pad.element.querySelector(".preview-status");
    if (preview)
        preview.textContent = `${service.previewLabel || message("UI.NoPreview")} · ${message(`Status.${service.previewStatus}`)}`;
    const previewButton = pad.element.querySelector('[data-action="togglePreview"]');
    if (previewButton) {
        const active = Boolean(service.preview.current || service.previewIntent);
        previewButton.textContent = message(active ? "UI.StopPreview" : "UI.Preview");
        previewButton.disabled = !active && !pad.selected;
    }
}
