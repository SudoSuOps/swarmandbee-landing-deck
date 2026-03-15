/**
 * Trace page — provenance viewer + Merkle proof verification.
 * Fetches from hive-ledger: /api/pairs/:id/trace, /api/proof/:pair_id, /api/verify
 */

async function lookupTrace() {
  const input = document.getElementById('trace-input').value.trim();
  const results = document.getElementById('trace-results');
  const error = document.getElementById('trace-error');
  const btn = document.getElementById('trace-btn');

  error.textContent = '';
  results.innerHTML = '';

  if (!input) {
    error.textContent = 'Enter a pair ID (e.g. HIVE-AVI-abc123def456)';
    return;
  }

  btn.textContent = 'Looking up...';
  btn.disabled = true;

  try {
    const [trace, proof] = await Promise.allSettled([
      SB.ledger('/api/pairs/' + encodeURIComponent(input) + '/trace'),
      SB.ledger('/api/proof/' + encodeURIComponent(input))
    ]);

    const traceData = trace.status === 'fulfilled' ? trace.value : null;
    const proofData = proof.status === 'fulfilled' ? proof.value : null;

    if (!traceData && !proofData) {
      error.textContent = 'Pair not found. Check the ID and try again.';
      btn.textContent = 'Trace';
      btn.disabled = false;
      return;
    }

    results.innerHTML = renderTrace(traceData, proofData, input);
  } catch (e) {
    error.textContent = 'Connection error. Ledger may be unavailable.';
  }

  btn.textContent = 'Trace';
  btn.disabled = false;
}

function renderTrace(trace, proof, pairId) {
  let html = '';

  // Pair summary
  if (trace) {
    html += '<div class="trace-card">';
    html += '<div class="trace-label">Pair</div>';
    html += '<div class="trace-row"><span class="trace-key">ID</span><span class="trace-val mono">' + esc(trace.pair_id || pairId) + '</span></div>';
    if (trace.domain) html += '<div class="trace-row"><span class="trace-key">Domain</span><span class="trace-val">' + esc(trace.domain) + '</span></div>';
    if (trace.tier) html += '<div class="trace-row"><span class="trace-key">Tier</span><span class="trace-val tier-' + esc(trace.tier) + '">' + esc(trace.tier) + '</span></div>';
    if (trace.task_type) html += '<div class="trace-row"><span class="trace-key">Task</span><span class="trace-val">' + esc(trace.task_type) + '</span></div>';
    if (trace.score != null) html += '<div class="trace-row"><span class="trace-key">JellyScore</span><span class="trace-val mono">' + Number(trace.score).toFixed(1) + '</span></div>';
    if (trace.fingerprint) html += '<div class="trace-row"><span class="trace-key">Fingerprint</span><span class="trace-val mono" style="font-size:.75rem;word-break:break-all">' + esc(trace.fingerprint) + '</span></div>';
    html += '</div>';
  }

  // JellyScore components
  if (trace && trace.components) {
    const c = trace.components;
    html += '<div class="trace-card">';
    html += '<div class="trace-label">JellyScore Components</div>';
    const comps = [
      ['Source Confidence', c.source_confidence],
      ['Gate Integrity', c.gate_integrity],
      ['Reasoning Depth', c.reasoning_depth],
      ['Entropy Health', c.entropy_health],
      ['Fingerprint Uniqueness', c.fingerprint_uniqueness]
    ];
    for (const [name, val] of comps) {
      if (val != null) {
        const pct = (Number(val) * 100).toFixed(1);
        html += '<div class="trace-row">';
        html += '<span class="trace-key">' + name + '</span>';
        html += '<span class="trace-val"><span class="score-bar"><span class="score-fill" style="width:' + pct + '%"></span></span> <span class="mono">' + Number(val).toFixed(3) + '</span></span>';
        html += '</div>';
      }
    }
    html += '</div>';
  }

  // 6 deterministic gates
  if (trace && trace.gates) {
    const g = trace.gates;
    html += '<div class="trace-card">';
    html += '<div class="trace-label">Deterministic Gates (' + (trace.gates_passed || '?') + '/6)</div>';
    const gates = [
      ['JSON Valid', g.json_valid ?? g.gate_json_valid],
      ['Output Length', g.output_length ?? g.gate_output_length],
      ['Numeric Verify', g.numeric_verify ?? g.gate_numeric_verify],
      ['Concept Present', g.concept_present ?? g.gate_concept_present],
      ['Dedup', g.dedup ?? g.gate_dedup],
      ['Degenerate', g.degenerate ?? g.gate_degenerate]
    ];
    for (const [name, val] of gates) {
      const pass = val === true || val === 1;
      html += '<div class="trace-row">';
      html += '<span class="trace-key">' + name + '</span>';
      html += '<span class="trace-val ' + (pass ? 'gate-pass' : 'gate-fail') + '">' + (pass ? 'PASS' : 'FAIL') + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Lineage
  if (trace && (trace.gen_model || trace.cook_script || trace.batch_id)) {
    html += '<div class="trace-card">';
    html += '<div class="trace-label">Lineage</div>';
    if (trace.gen_model) html += '<div class="trace-row"><span class="trace-key">Gen Model</span><span class="trace-val mono">' + esc(trace.gen_model) + '</span></div>';
    if (trace.cook_script) html += '<div class="trace-row"><span class="trace-key">Cook Script</span><span class="trace-val mono">' + esc(trace.cook_script) + '</span></div>';
    if (trace.batch_id) html += '<div class="trace-row"><span class="trace-key">Batch</span><span class="trace-val mono">' + esc(trace.batch_id) + '</span></div>';
    if (trace.created_at) html += '<div class="trace-row"><span class="trace-key">Created</span><span class="trace-val">' + new Date(trace.created_at).toLocaleString() + '</span></div>';
    html += '</div>';
  }

  // Merkle proof
  if (proof) {
    html += '<div class="trace-card">';
    html += '<div class="trace-label">Merkle Proof</div>';
    if (proof.merkle_root) html += '<div class="trace-row"><span class="trace-key">Root</span><span class="trace-val mono" style="font-size:.72rem;word-break:break-all">' + esc(proof.merkle_root) + '</span></div>';
    if (proof.leaf) html += '<div class="trace-row"><span class="trace-key">Leaf</span><span class="trace-val mono" style="font-size:.72rem;word-break:break-all">' + esc(proof.leaf) + '</span></div>';
    if (proof.path && proof.path.length) {
      html += '<div class="trace-row"><span class="trace-key">Proof Path</span><span class="trace-val mono" style="font-size:.72rem">' + proof.path.length + ' nodes</span></div>';
      html += '<div class="proof-tree">';
      for (let i = 0; i < proof.path.length; i++) {
        const node = proof.path[i];
        const side = node.position || node.side || (i % 2 === 0 ? 'L' : 'R');
        html += '<div class="proof-node"><span class="proof-level">L' + i + ' ' + side + '</span><span class="proof-hash">' + esc(node.hash || node) + '</span></div>';
      }
      html += '</div>';
    }
    html += '<button class="verify-btn" onclick="verifyProof(\'' + esc(pairId) + '\')">Verify Proof</button>';
    html += '<div id="verify-result"></div>';
    html += '</div>';
  }

  return html;
}

async function verifyProof(pairId) {
  const el = document.getElementById('verify-result');
  el.textContent = 'Verifying...';
  el.className = '';
  try {
    const result = await SB.ledger('/api/verify?pair_id=' + encodeURIComponent(pairId));
    if (result.valid || result.verified) {
      el.textContent = 'VERIFIED — Proof is valid.';
      el.className = 'verify-pass';
    } else {
      el.textContent = 'INVALID — Proof did not verify.';
      el.className = 'verify-fail';
    }
  } catch {
    el.textContent = 'Verification unavailable.';
    el.className = 'verify-fail';
  }
}

function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

// Allow Enter key in search
document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('trace-input');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        lookupTrace();
      }
    });
  }
});
