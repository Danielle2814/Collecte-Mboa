const API_SONDAGE = '/api/sondage';
const API_STATS = '/api/stats';
const LOCAL_PENDING_KEY = 'mboa_pending_submissions';
const LOCAL_LAST_RESPONSE_KEY = 'mboa_last_response';

function savePendingSubmission(payload) {
    const pending = JSON.parse(localStorage.getItem(LOCAL_PENDING_KEY) || '[]');
    pending.push({ payload, date: new Date().toISOString() });
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
                    messageDiv.textContent = result.message;
                    messageDiv.style.color = '#E67E22';
                    return;
                }
                
                if (response.ok) {
                    //  SUCCÈS
                    localStorage.setItem(HAS_VOTED_KEY, 'true');
                    saveLastResponse(payload, 'success');
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
                saveLastResponse(payload, 'pending');
                savePendingSubmission(payload);
                messageDiv.textContent = 'Connexion impossible. Ta réponse est sauvegardée localement et sera renvoyée dès que possible.';
                messageDiv.style.color = '#E74C3C';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = ' Envoyer mon profil culinaire';
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
                const data = await response.json();
                
                document.getElementById('total-reponses').textContent = data.total_reponses;
                document.getElementById('budget-moyen').textContent = data.budget_moyen.toLocaleString();
                
                // === INSIGHTS ===
                const box = document.getElementById('insight-box');
                let insights = [];
                if (data.total_reponses > 0) {
                    if (data.plats_saoulants.labels.length) insights.push(` Plat le plus détesté : <strong>${data.plats_saoulants.labels[0]}</strong> (${data.plats_saoulants.data[0]} votes)`);
                    if (data.repas_flemme.labels.length) insights.push(` Flemme ultime = <strong>${data.repas_flemme.labels[0]}</strong>`);
                } else {
                    insights.push("📭 Aucune donnée. Remplis le questionnaire !");
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
                document.getElementById('insight-box').innerHTML = ' Serveur injoignable. Lance "python backend/app.py" !';
                const container = document.getElementById('odeurs-maison-container');
                if (container) container.innerHTML = '<p>Pas de données serveurs disponibles.</p>';
                renderLocalResponse();
            }
        }
        
        loadStats();
        setInterval(loadStats, 30000);