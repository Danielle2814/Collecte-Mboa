const API_SONDAGE = '/api/sondage';
const API_STATS = '/api/stats';
const LOCAL_PENDING_KEY = 'mboa_pending_submissions';
const LOCAL_LAST_RESPONSE_KEY = 'mboa_last_response';
const LOCAL_SAVED_RESPONSES_KEY = 'mboa_saved_responses';
const LOCAL_SHARED_RESPONSES_KEY = 'mboa_shared_responses';
const HAS_VOTED_KEY = 'mboa_sondage_deja_fait';

function getRecords(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function saveRecords(key, records) {
    localStorage.setItem(key, JSON.stringify(records));
}

function hasVoted() {
    return localStorage.getItem(HAS_VOTED_KEY) === 'true';
}

function setVotedFlag() {
    localStorage.setItem(HAS_VOTED_KEY, 'true');
}

function disableFormAfterSubmit(form) {
    if (!form) return;
    form.querySelectorAll('input, textarea, select, button').forEach(element => {
        if (element.type !== 'button') {
            element.disabled = true;
        }
    });
}

function makeLocalRecord(payload, source = 'local') {
    const copy = { ...payload };
    const id = copy.id || `${source}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    delete copy.id;
    return {
        id,
        source,
        date: new Date().toISOString(),
        payload: copy
    };
}

function saveResponseLocally(payload) {
    const records = getRecords(LOCAL_SAVED_RESPONSES_KEY);
    const record = makeLocalRecord(payload, 'local');
    if (!records.some(r => r.id === record.id)) {
        records.push(record);
        saveRecords(LOCAL_SAVED_RESPONSES_KEY, records);
    }
}

function savePendingSubmission(payload) {
    saveResponseLocally(payload);
    setVotedFlag();
    const pending = JSON.parse(localStorage.getItem(LOCAL_PENDING_KEY) || '[]');
    const fingerprint = JSON.stringify(payload);
    if (!pending.some(item => JSON.stringify(item.payload) === fingerprint)) {
        pending.push({ payload, date: new Date().toISOString() });
    }
    localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(pending));
}

function saveLastResponse(payload, status = 'success') {
    const stored = {
        payload,
        status,
        date: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_LAST_RESPONSE_KEY, JSON.stringify(stored));
}

function getLastResponse() {
    return JSON.parse(localStorage.getItem(LOCAL_LAST_RESPONSE_KEY) || 'null');
}

function getSavedPayloads() {
    return getRecords(LOCAL_SAVED_RESPONSES_KEY).map(r => r.payload);
}

function getSharedPayloads() {
    return getRecords(LOCAL_SHARED_RESPONSES_KEY).map(r => r.payload);
}

function getPendingPayloads() {
    return JSON.parse(localStorage.getItem(LOCAL_PENDING_KEY) || '[]').map(item => item.payload || {});
}

function getLastPayload() {
    const last = getLastResponse();
    return last && last.payload ? [last.payload] : [];
}

function getLocalResponses() {
    const responses = [
        ...getSavedPayloads(),
        ...getSharedPayloads(),
        ...getPendingPayloads(),
        ...getLastPayload()
    ];
    const seen = new Set();
    return responses.filter(payload => {
        try {
            const key = JSON.stringify(payload);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        } catch (err) {
            return true;
        }
    });
}

function normalizeImportedRecords(raw) {
    const imported = Array.isArray(raw) ? raw : raw.records || [];
    return imported
        .filter(item => item && (item.payload || typeof item === 'object'))
        .map(item => {
            const payload = item.payload ? { ...item.payload } : { ...item };
            const id = item.id || `imported-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            delete payload.id;
            return {
                id,
                source: 'imported',
                date: item.date || new Date().toISOString(),
                payload
            };
        });
}

function mergeImportedRecords(records) {
    const existing = getRecords(LOCAL_SHARED_RESPONSES_KEY);
    const merged = [...existing];
    records.forEach(record => {
        if (!merged.some(r => r.id === record.id)) {
            merged.push(record);
        }
    });
    saveRecords(LOCAL_SHARED_RESPONSES_KEY, merged);
    return merged;
}

function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function getShareStatusElement() {
    return document.getElementById('share-status');
}

function setShareStatus(message, isError = false) {
    const el = getShareStatusElement();
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#E74C3C' : '#27AE60';
}

function exportLocalData() {
    const saved = getRecords(LOCAL_SAVED_RESPONSES_KEY);
    const shared = getRecords(LOCAL_SHARED_RESPONSES_KEY);
    const records = [...saved, ...shared];
    if (!records.length) {
        setShareStatus('Aucune donnée locale à exporter.', true);
        return;
    }
    downloadJSON(
        `mboa-collect-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
        {
            version: 1,
            exportedAt: new Date().toISOString(),
            records
        }
    );
    setShareStatus('Fichier exporté. Partage-le avec d’autres téléphones.');
}

function handleImportedFile(file) {
    const reader = new FileReader();
    reader.onload = event => {
        try {
            const raw = JSON.parse(event.target.result);
            const importedRecords = normalizeImportedRecords(raw);
            if (!importedRecords.length) {
                setShareStatus('Le fichier importé ne contient aucune donnée valide.', true);
                return;
            }
            mergeImportedRecords(importedRecords);
            loadStats();
            setShareStatus(`${importedRecords.length} donnée(s) importée(s). Les graphiques ont été mis à jour.`);
        } catch (err) {
            console.error(err);
            setShareStatus('Erreur à l’importation : fichier invalide.', true);
        }
    };
    reader.readAsText(file);
}

function setupDashboardSharing() {
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const loadLocalBtn = document.getElementById('load-local-btn');
    const importInput = document.getElementById('import-file-input');

    if (exportBtn) {
        exportBtn.addEventListener('click', exportLocalData);
    }
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', event => {
            const file = event.target.files[0];
            if (file) {
                handleImportedFile(file);
            }
            event.target.value = '';
        });
    }
    if (loadLocalBtn) {
        loadLocalBtn.addEventListener('click', loadLocalDataNow);
    }
}

function renderLocalResponse() {
    const container = document.getElementById('local-response-container');
    if (!container) return;

    const stored = getLastResponse();
    if (!stored) {
        container.innerHTML = '<p>Aucune réponse locale détectée.</p>';
        return;
    }

    const payload = stored.payload || {};
    const status = stored.status === 'success' ? 'Envoyée / enregistrée' : 'En attente d’envoi';
    const date = new Date(stored.date).toLocaleString();

    const lines = [];
    function addLine(label, value) {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value) && value.length === 0) return;
        lines.push(`<div><strong>${label} :</strong> ${Array.isArray(value) ? value.join(', ') : value}</div>`);
    }

    addLine('Date', date);
    addLine('Statut', status);
    addLine('Équipement', payload.equipement);
    addLine('Frigo vide', payload.frigo_vide);
    addLine('Repas 3 jours', payload.repas_3_jours);
    addLine('Plat saoulant', payload.plat_saoulant);
    addLine('Repas flemme', payload.repas_flemme);
    addLine('Budget max', payload.budget_max);
    addLine('Ingrédients phares', payload.ingredients_phares);
    addLine('Plats capable', payload.plats_capable);
    addLine('Temps max', payload.temps_max);
    addLine('Peur cuisine', payload.peur_cuisine);
    addLine('Odeur maison', payload.odeur_maison);
    addLine('Odeur préférée', payload.odeur_preferee);
    addLine('Genie choix', payload.genie_choix);

    container.innerHTML = lines.length ? lines.join('') : '<p>Aucune réponse locale détaillée.</p>';
}

function loadLocalDataNow() {
    const responses = getLocalResponses();
    if (!responses.length) {
        setShareStatus('Aucune donnée locale enregistrée sur ce téléphone.', true);
        return;
    }
    const offlineData = buildOfflineStats(responses);
    renderCharts(offlineData);
    setShareStatus(`Données locales chargées (${responses.length} réponse(s)).`);
}

function renderLocalCount() {
    const localCount = getLocalResponses().length;
    const status = document.getElementById('share-status');
    if (status) {
        if (localCount > 0) {
            status.textContent = `Données locales détectées : ${localCount} réponse(s).`; 
            status.style.color = '#555';
        } else {
            status.textContent = 'Aucune donnée locale détectée sur ce téléphone.';
            status.style.color = '#555';
        }
    }
}

function buildOfflineStats(responses) {
    const labelMap = {
        'friture_poisson': 'Poisson Frit', 'oignon_ail': 'Oignon/Ail',
        'viande_braisee': 'Viande Braisée', 'sauce_arachide': 'Sauce Arachide',
        'beignets': 'Beignets'
    };

    const equipements = { 'Plaque unique': 0, 'Frigo': 0, 'Micro-ondes': 0, 'Rien du tout': 0 };
    const budgetRanges = { '0-500 FCFA': 0, '501-1000 FCFA': 0, '1001-2000 FCFA': 0, '2000+ FCFA': 0 };
    const peurs = {};
    const odeurs = {};
    const platsSaoulants = {};
    const repasFlemme = {};
    const odeursMaison = [];
    let budgetTotal = 0;

    responses.forEach(payload => {
        const eq = payload.equipement || [];
        if (Array.isArray(eq)) {
            eq.forEach(value => {
                if (value.includes('plaque')) equipements['Plaque unique'] += 1;
                if (value.includes('frigo')) equipements['Frigo'] += 1;
                if (value.includes('micro_ondes') || value.includes('micro')) equipements['Micro-ondes'] += 1;
                if (value === 'rien') equipements['Rien du tout'] += 1;
            });
        }

        const budget = parseInt(payload.budget_max, 10) || 0;
        budgetTotal += budget;
        if (budget <= 500) budgetRanges['0-500 FCFA'] += 1;
        else if (budget <= 1000) budgetRanges['501-1000 FCFA'] += 1;
        else if (budget <= 2000) budgetRanges['1001-2000 FCFA'] += 1;
        else budgetRanges['2000+ FCFA'] += 1;

        const peur = payload.peur_cuisine;
        if (peur) peurs[peur] = (peurs[peur] || 0) + 1;

        const odeur = payload.odeur_preferee;
        if (odeur) odeurs[odeur] = (odeurs[odeur] || 0) + 1;

        const plat = payload.plat_saoulant;
        if (plat) platsSaoulants[plat] = (platsSaoulants[plat] || 0) + 1;

        const flemme = payload.repas_flemme;
        if (flemme) repasFlemme[flemme] = (repasFlemme[flemme] || 0) + 1;

        const odeurMaison = payload.odeur_maison;
        if (odeurMaison) odeursMaison.push(odeurMaison);
    });

    const total = responses.length;
    return {
        total_reponses: total,
        budget_moyen: total ? Math.round((budgetTotal / total) * 100) / 100 : 0,
        odeurs: {
            labels: Object.keys(odeurs).map(k => labelMap[k] || k),
            data: Object.values(odeurs),
            backgroundColor: Object.keys(odeurs).map((_, index) => ['#E74C3C', '#F39C12', '#C0392B', '#D35400', '#F1C40F'][index % 5])
        },
        equipement: {
            labels: Object.keys(equipements),
            data: Object.values(equipements),
            backgroundColor: ['#3498DB', '#2ECC71', '#9B59B6', '#E74C3C']
        },
        budget_detail: {
            labels: Object.keys(budgetRanges),
            data: Object.values(budgetRanges),
            backgroundColor: '#E67E22'
        },
        peurs: {
            labels: Object.keys(peurs).map(k => {
                const map = {
                    'rater_cuisson': 'Rater la cuisson', 'gachis': 'Gâcher ingrédients',
                    'vaisselle': 'Trop de vaisselle', 'temps': 'Perdre 2h'
                };
                return map[k] || k;
            }),
            data: Object.values(peurs),
            backgroundColor: ['#E74C3C', '#F1C40F', '#3498DB', '#9B59B6'].slice(0, Object.keys(peurs).length)
        },
        plats_saoulants: {
            labels: Object.keys(platsSaoulants),
            data: Object.values(platsSaoulants)
        },
        repas_flemme: {
            labels: Object.keys(repasFlemme),
            data: Object.values(repasFlemme)
        },
        odeurs_maison: odeursMaison.slice(0, 10)
    };
}

function mergeSeries(remoteSeries, localSeries) {
    const counts = {};
    const palette = ['#E74C3C', '#F39C12', '#C0392B', '#D35400', '#F1C40F', '#3498DB', '#2ECC71', '#9B59B6', '#A569BD', '#5DADE2'];

    if (remoteSeries && Array.isArray(remoteSeries.labels)) {
        remoteSeries.labels.forEach((label, index) => {
            counts[label] = (counts[label] || 0) + (remoteSeries.data[index] || 0);
        });
    }

    if (localSeries && Array.isArray(localSeries.labels)) {
        localSeries.labels.forEach((label, index) => {
            counts[label] = (counts[label] || 0) + (localSeries.data[index] || 0);
        });
    }

    const labels = Object.keys(counts);
    return {
        labels,
        data: labels.map(label => counts[label]),
        backgroundColor: labels.map((_, index) => palette[index % palette.length])
    };
}

function getCombinedData(remoteData) {
    const localResponses = getLocalResponses();
    if (!localResponses.length) return remoteData;

    const localData = buildOfflineStats(localResponses);
    const totalRemote = remoteData.total_reponses || 0;
    const totalLocal = localData.total_reponses || 0;
    const remoteBudgetSum = (remoteData.budget_moyen || 0) * totalRemote;
    const localBudgetSum = (localData.budget_moyen || 0) * totalLocal;
    const total = totalRemote + totalLocal;
    const budget_moyen = total ? Math.round(((remoteBudgetSum + localBudgetSum) / total) * 100) / 100 : 0;

    return {
        ...remoteData,
        total_reponses: total,
        budget_moyen,
        odeurs: mergeSeries(remoteData.odeurs, localData.odeurs),
        equipement: mergeSeries(remoteData.equipement, localData.equipement),
        budget_detail: mergeSeries(remoteData.budget_detail, localData.budget_detail),
        peurs: mergeSeries(remoteData.peurs, localData.peurs),
        plats_saoulants: mergeSeries(remoteData.plats_saoulants, localData.plats_saoulants),
        repas_flemme: mergeSeries(remoteData.repas_flemme, localData.repas_flemme),
        odeurs_maison: [...new Set([...(remoteData.odeurs_maison || []), ...(localData.odeurs_maison || [])])].slice(0, 20),
        _localCount: totalLocal
    };
}

function renderCharts(data) {
    if (!document.getElementById('insight-box')) return;

    const box = document.getElementById('insight-box');
    box.innerHTML = '';
    const insights = [];
    if (data.total_reponses > 0) {
        if (data.plats_saoulants.labels.length) insights.push(`Plat le plus détesté : <strong>${data.plats_saoulants.labels[0]}</strong> (${data.plats_saoulants.data[0]} vote(s))`);
        if (data.repas_flemme.labels.length) insights.push(`Flemme ultime : <strong>${data.repas_flemme.labels[0]}</strong>`);
    } else {
        insights.push(' Aucune donnée. Remplis le questionnaire !');
    }
    box.innerHTML = insights.join('<br>');

    document.getElementById('total-reponses').textContent = data.total_reponses;
    document.getElementById('budget-moyen').textContent = data.budget_moyen.toLocaleString();

    destroyChart('platSaoulant');
    destroyChart('repasFlemme');
    destroyChart('odeur');
    destroyChart('equipement');
    destroyChart('peur');
    destroyChart('budget');

    const ctx1 = document.getElementById('platSaoulantChart')?.getContext('2d');
    if (ctx1) {
        charts['platSaoulant'] = new Chart(ctx1, {
            type: 'bar', data: { labels: data.plats_saoulants.labels, datasets: [{ data: data.plats_saoulants.data, backgroundColor: '#E74C3C', borderRadius: 8 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctx2 = document.getElementById('repasFlemmeChart')?.getContext('2d');
    if (ctx2) {
        charts['repasFlemme'] = new Chart(ctx2, {
            type: 'bar', data: { labels: data.repas_flemme.labels, datasets: [{ data: data.repas_flemme.data, backgroundColor: '#F39C12', borderRadius: 8 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctx3 = document.getElementById('odeurChart')?.getContext('2d');
    if (ctx3) {
        charts['odeur'] = new Chart(ctx3, {
            type: 'pie', data: { labels: data.odeurs.labels, datasets: [{ data: data.odeurs.data, backgroundColor: data.odeurs.backgroundColor }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const ctx4 = document.getElementById('equipementChart')?.getContext('2d');
    if (ctx4) {
        charts['equipement'] = new Chart(ctx4, {
            type: 'bar', data: { labels: data.equipement.labels, datasets: [{ data: data.equipement.data, backgroundColor: data.equipement.backgroundColor, borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctx5 = document.getElementById('peurChart')?.getContext('2d');
    if (ctx5) {
        charts['peur'] = new Chart(ctx5, {
            type: 'doughnut', data: { labels: data.peurs.labels, datasets: [{ data: data.peurs.data, backgroundColor: data.peurs.backgroundColor }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom' } } }
        });
    }

    const ctx6 = document.getElementById('budgetChart')?.getContext('2d');
    if (ctx6) {
        charts['budget'] = new Chart(ctx6, {
            type: 'bar', data: { labels: data.budget_detail.labels, datasets: [{ data: data.budget_detail.data, backgroundColor: '#E67E22', borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const container = document.getElementById('odeurs-maison-container');
    if (container) {
        if (data.odeurs_maison && data.odeurs_maison.length > 0) {
            container.innerHTML = data.odeurs_maison.map(o => `<span class="mot-tag"> ${o}</span>`).join('');
        } else {
            container.innerHTML = '<p>Aucune réponse pour l\'instant.</p>';
        }
    }
}

async function trySendPendingSubmissions() {
    const pending = JSON.parse(localStorage.getItem('mboa_pending_submissions') || '[]');
    if (!pending.length) return;

    const remaining = [];
    for (const item of pending) {
        try {
            const response = await fetch(API_SONDAGE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload)
            });
            if (response.ok) {
                saveLastResponse(item.payload, 'success');
            } else {
                remaining.push(item);
            }
        } catch (err) {
            remaining.push(item);
        }
    }

    localStorage.setItem('mboa_pending_submissions', JSON.stringify(remaining));
}

document.addEventListener('DOMContentLoaded', function() {
    
    // === ANTI-DOUBLON COOKIE ===
    const HAS_VOTED_KEY = 'mboa_sondage_deja_fait';
    
    if (localStorage.getItem(HAS_VOTED_KEY) === 'true') {
        const container = document.querySelector('.app-container');
        container.innerHTML = `
            <header>
                <h1>MboaTest</h1>
                <p class="subtitle">Merci infiniment pour ta contribution !</p>
            </header>
            <div class="card" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 5rem; margin-bottom: 20px;">✅</div>
                <h2>Tu as déjà participé !</h2>
                <p style="color: #555;">Ton profil culinaire est bien enregistré dans notre base.</p>
                <p style="color: #555;">Les autres étudiants te remercient.</p>
                <a href="/dashboard" style="display: inline-block; margin-top: 20px; background: #E67E22; color: white; padding: 15px 30px; border-radius: 50px; text-decoration: none; font-weight: bold;">
                     Voir le Dashboard
                </a>
            </div>
        `;
        return;
    }
    
    // === GESTION CHECKBOX "RIEN" (exclusif) ===
    const checkboxes = document.querySelectorAll('input[name="equipement"]');
    const rienCheckbox = Array.from(checkboxes).find(cb => cb.value === 'rien');
    
    if (rienCheckbox) {
        rienCheckbox.addEventListener('change', function() {
            if (this.checked) {
                checkboxes.forEach(cb => { if (cb !== this) cb.checked = false; });
            }
        });
    }
    
    checkboxes.forEach(cb => {
        if (cb.value !== 'rien') {
            cb.addEventListener('change', function() {
                if (this.checked && rienCheckbox) rienCheckbox.checked = false;
            });
        }
    });

    // === SOUMISSION DU FORMULAIRE ===
    const form = document.getElementById('sondage-form');
    const messageDiv = document.getElementById('form-message');
    const submitBtn = document.getElementById('submit-btn');

    if (form) {
        const budgetBtns = document.querySelectorAll('#budget-group .btn-choice');
        const budgetInput = document.getElementById('budget-input');

        budgetBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                budgetBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                budgetInput.value = this.dataset.budget;
            });
        });

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            submitBtn.disabled = true;
            submitBtn.textContent = ' Envoi en cours...';
            messageDiv.textContent = '';
            messageDiv.style.color = '#27AE60';

            // Récupération équipement
            const equipementChecked = Array.from(
                document.querySelectorAll('input[name="equipement"]:checked')
            ).map(cb => cb.value);

            // Récupération peur
            let peur = '';
            document.querySelectorAll('input[name="peur"]').forEach(r => {
                if (r.checked) peur = r.value;
            });

            // Construction du payload COMPLET
            const payload = {
                // Logistique
                equipement: equipementChecked,
                frigo_vide: document.getElementById('frigo-vide').value,
                
                // Quotidien réel
                repas_3_jours: document.getElementById('repas-3-jours').value.trim(),
                plat_saoulant: document.getElementById('plat-saoulant').value.trim(),
                repas_flemme: document.getElementById('repas-flemme').value.trim(),
                
                // Budget
                budget_max: parseInt(budgetInput.value),
                ingredients_phares: document.getElementById('ingredients-input').value.trim(),
                
                // Compétences
                plats_capable: document.getElementById('plats-capable').value.trim(),
                temps_max: document.getElementById('temps-max').value,
                peur_cuisine: peur,
                
                // Sensoriel
                odeur_maison: document.getElementById('odeur-maison').value.trim(),
                odeur_preferee: document.getElementById('odeur-select').value,
                
                // Aspiration
                genie_choix: document.getElementById('genie-choix').value
            };

            console.log(" Envoi du payload :", payload);

            try {
                const response = await fetch(API_SONDAGE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                
                if (response.status === 429) {
                    // IP bloquée
                    setVotedFlag();
                    disableFormAfterSubmit(form);
                    submitBtn.textContent = ' Déjà soumis';
                    messageDiv.textContent = result.message;
                    messageDiv.style.color = '#E67E22';
                    return;
                }
                
                if (response.ok) {
                    //  SUCCÈS
                    setVotedFlag();
                    saveResponseLocally(payload);
                    saveLastResponse(payload, 'success');
                    disableFormAfterSubmit(form);
                    submitBtn.textContent = ' Soumission terminée';
                    messageDiv.textContent = ' Merci ! Ton profil est enregistré. Va voir le dashboard !';
                    messageDiv.style.color = '#27AE60';
                    form.reset();
                    budgetBtns.forEach(b => b.classList.remove('active'));
                    const defaultBudget = document.querySelector('[data-budget="1000"]');
                    if (defaultBudget) defaultBudget.classList.add('active');
                } else {
                    throw new Error(result.message || 'Erreur serveur');
                }
            } catch (error) {
                console.error(' Erreur:', error);
                setVotedFlag();
                saveLastResponse(payload, 'pending');
                savePendingSubmission(payload);
                disableFormAfterSubmit(form);
                submitBtn.textContent = ' En attente de renvoi';
                messageDiv.textContent = 'Connexion impossible. Ta réponse est sauvegardée localement et ne pourra plus être envoyée une deuxième fois.';
                messageDiv.style.color = '#E74C3C';
            } finally {
                if (!hasVoted()) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = ' Envoyer mon profil culinaire';
                }
            }
        });
    }

    trySendPendingSubmissions();
    window.addEventListener('online', trySendPendingSubmissions);
    renderLocalResponse();
});

// JS Dashboard

        let charts = {};
        
        function destroyChart(key) {
            if (charts[key]) { charts[key].destroy(); delete charts[key]; }
        }
        
        async function loadStats() {
            try {
                const response = await fetch(API_STATS);
                const serverData = await response.json();
                const data = getCombinedData(serverData);
                
                document.getElementById('total-reponses').textContent = data.total_reponses;
                document.getElementById('budget-moyen').textContent = data.budget_moyen.toLocaleString();
                
                // === INSIGHTS ===
                const box = document.getElementById('insight-box');
                let insights = [];
                if (data.total_reponses > 0) {
                    if (data.plats_saoulants.labels.length) insights.push(` Plat le plus détesté : <strong>${data.plats_saoulants.labels[0]}</strong> (${data.plats_saoulants.data[0]} votes)`);
                    if (data.repas_flemme.labels.length) insights.push(` Flemme ultime = <strong>${data.repas_flemme.labels[0]}</strong>`);
                    if (data._localCount) {
                        insights.push(`Inclut ${data._localCount} réponse(s) locales + ${serverData.total_reponses} réponse(s) serveur`);
                    }
                } else {
                    insights.push(" Aucune donnée. Remplis le questionnaire !");
                }
                box.innerHTML = insights.join('<br>');
                
                // === GRAPHIQUES ===
                destroyChart('platSaoulant');
                destroyChart('repasFlemme');
                destroyChart('odeur');
                destroyChart('equipement');
                destroyChart('peur');
                destroyChart('budget');
                
                const ctx1 = document.getElementById('platSaoulantChart').getContext('2d');
                charts['platSaoulant'] = new Chart(ctx1, {
                    type: 'bar', data: { labels: data.plats_saoulants.labels, datasets: [{ data: data.plats_saoulants.data, backgroundColor: '#E74C3C', borderRadius: 8 }] },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
                
                const ctx2 = document.getElementById('repasFlemmeChart').getContext('2d');
                charts['repasFlemme'] = new Chart(ctx2, {
                    type: 'bar', data: { labels: data.repas_flemme.labels, datasets: [{ data: data.repas_flemme.data, backgroundColor: '#F39C12', borderRadius: 8 }] },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
                
                const ctx3 = document.getElementById('odeurChart').getContext('2d');
                charts['odeur'] = new Chart(ctx3, {
                    type: 'pie', data: { labels: data.odeurs.labels, datasets: [{ data: data.odeurs.data, backgroundColor: data.odeurs.backgroundColor }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                });
                
                const ctx4 = document.getElementById('equipementChart').getContext('2d');
                charts['equipement'] = new Chart(ctx4, {
                    type: 'bar', data: { labels: data.equipement.labels, datasets: [{ data: data.equipement.data, backgroundColor: data.equipement.backgroundColor, borderRadius: 8 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
                
                const ctx5 = document.getElementById('peurChart').getContext('2d');
                charts['peur'] = new Chart(ctx5, {
                    type: 'doughnut', data: { labels: data.peurs.labels, datasets: [{ data: data.peurs.data, backgroundColor: data.peurs.backgroundColor }] },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom' } } }
                });
                
                const ctx6 = document.getElementById('budgetChart').getContext('2d');
                charts['budget'] = new Chart(ctx6, {
                    type: 'bar', data: { labels: data.budget_detail.labels, datasets: [{ data: data.budget_detail.data, backgroundColor: '#E67E22', borderRadius: 8 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
                
                // === NUAGE DE MOTS ODEURS MAISON ===
                const container = document.getElementById('odeurs-maison-container');
                if (data.odeurs_maison && data.odeurs_maison.length > 0) {
                    container.innerHTML = data.odeurs_maison.map(o => `<span class="mot-tag"> ${o}</span>`).join('');
                } else {
                    container.innerHTML = '<p>Aucune réponse pour l\'instant.</p>';
                }
                
            } catch (error) {
                console.error(error);
                const insightBox = document.getElementById('insight-box');
                if (insightBox) insightBox.innerHTML = ' Serveur injoignable. Les graphiques ci-dessous sont basés sur ta dernière réponse locale.';
                const container = document.getElementById('odeurs-maison-container');
                if (container) container.innerHTML = '<p>Pas de données serveurs disponibles.</p>';
                const offlineData = buildOfflineStats(getLocalResponses());
                renderCharts(offlineData);
                renderLocalResponse();
            }
        }
        
        const dashboardElement = document.getElementById('insight-box');
        if (dashboardElement) {
            setupDashboardSharing();
            renderLocalCount();
            loadStats();
            setInterval(loadStats, 30000);
        }