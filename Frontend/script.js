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
    
    // === GESTION BUDGET ===
    const budgetBtns = document.querySelectorAll('#budget-group .btn-choice');
    const budgetInput = document.getElementById('budget-input');
    
    budgetBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            budgetBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            budgetInput.value = this.dataset.budget;
        });
    });

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

        console.log("📤 Envoi du payload :", payload);

        try {
            const response = await fetch('http://localhost:5000/api/sondage', {
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
            messageDiv.textContent = ' Erreur réseau. Vérifie ta connexion et réessaie.';
            messageDiv.style.color = '#E74C3C';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = ' Envoyer mon profil culinaire';
        }
    });
});

// JS Dashboard

        let charts = {};
        
        function destroyChart(key) {
            if (charts[key]) { charts[key].destroy(); delete charts[key]; }
        }
        
        async function loadStats() {
            try {
                const response = await fetch('http://localhost:5000/api/stats');
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
            }
        }
        
        loadStats();
        setInterval(loadStats, 30000);