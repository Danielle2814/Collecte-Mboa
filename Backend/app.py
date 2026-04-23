"""MboaCollect - API Backend"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='../Frontend', static_url_path='')
CORS(app)

# === INITIALISATION BASE DE DONNÉES ===
def init_db():
    os.makedirs('data', exist_ok=True)
    conn = sqlite3.connect('data/mboa_data.db')
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS sondages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipement TEXT,
            frigo_vide INTEGER,
            repas_3_jours TEXT,
            plat_saoulant TEXT,
            repas_flemme TEXT,
            budget_max INTEGER,
            ingredients_phares TEXT,
            plats_capable TEXT,
            temps_max INTEGER,
            peur_cuisine TEXT,
            odeur_maison TEXT,
            odeur_preferee TEXT,
            genie_choix TEXT,
            ip_address TEXT,
            date_soumission TIMESTAMP
        )
    ''')
    
    # Ajout des colonnes manquantes si la table existait avant
    nouvelles_colonnes = [
        'repas_3_jours TEXT',
        'plat_saoulant TEXT',
        'repas_flemme TEXT',
        'plats_capable TEXT',
        'temps_max INTEGER',
        'odeur_maison TEXT',
        'genie_choix TEXT'
    ]
    for col in nouvelles_colonnes:
        try:
            c.execute(f'ALTER TABLE sondages ADD COLUMN {col}')
        except sqlite3.OperationalError:
            pass  # Colonne existe déjà
    
    conn.commit()
    conn.close()

# === ROUTES ===

@app.route('/')
def serve_form():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(app.static_folder, 'dashboard.html')

@app.route('/api/sondage', methods=['POST'])
def recevoir_sondage():
    try:
        # Récupération IP
        ip_etudiant = request.remote_addr
        if request.headers.get('X-Forwarded-For'):
            ip_etudiant = request.headers.get('X-Forwarded-For').split(',')[0]
        
        data = request.json or {}
        conn = sqlite3.connect('data/mboa_data.db')
        c = conn.cursor()
        
        # === ANTI-DOUBLON IP (7 jours) ===
        il_y_a_7_jours = datetime.now() - timedelta(days=7)
        c.execute('SELECT COUNT(*) FROM sondages WHERE ip_address = ? AND date_soumission > ?', 
                  (ip_etudiant, il_y_a_7_jours))
        
        if c.fetchone()[0] > 0:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "Tu as déjà participé cette semaine. Reviens dans quelques jours !"
            }), 429
        
        # === INSERTION COMPLÈTE ===
        c.execute('''
            INSERT INTO sondages 
            (equipement, frigo_vide, repas_3_jours, plat_saoulant, repas_flemme,
             budget_max, ingredients_phares, plats_capable, temps_max, peur_cuisine,
             odeur_maison, odeur_preferee, genie_choix, ip_address, date_soumission)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            str(data.get('equipement', [])),
            data.get('frigo_vide', 0),
            data.get('repas_3_jours', ''),
            data.get('plat_saoulant', ''),
            data.get('repas_flemme', ''),
            data.get('budget_max', 0),
            data.get('ingredients_phares', ''),
            data.get('plats_capable', ''),
            data.get('temps_max', 30),
            data.get('peur_cuisine', ''),
            data.get('odeur_maison', ''),
            data.get('odeur_preferee', ''),
            data.get('genie_choix', ''),
            ip_etudiant,
            datetime.now()
        ))
        
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Merci!"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = sqlite3.connect('data/mboa_data.db')
    c = conn.cursor()
    
    # KPIs
    c.execute('SELECT COUNT(*) FROM sondages')
    total = c.fetchone()[0]
    
    c.execute('SELECT AVG(budget_max) FROM sondages')
    budget_moyen = c.fetchone()[0] or 0
    
    # === ODEURS PRÉFÉRÉES (Camembert) ===
    c.execute('''SELECT odeur_preferee, COUNT(*) FROM sondages 
                 WHERE odeur_preferee IS NOT NULL AND odeur_preferee != '' 
                 GROUP BY odeur_preferee ORDER BY COUNT(*) DESC''')
    odeurs_data = c.fetchall()
    
    odeurs_labels, odeurs_values, odeurs_couleurs = [], [], []
    color_map = {
        'friture_poisson': '#E74C3C', 'oignon_ail': '#F39C12',
        'viande_braisee': '#C0392B', 'sauce_arachide': '#D35400',
        'beignets': '#F1C40F'
    }
    label_map = {
        'friture_poisson': 'Poisson Frit ', 'oignon_ail': 'Oignon/Ail ',
        'viande_braisee': 'Viande Braisée ', 'sauce_arachide': 'Sauce Arachide ',
        'beignets': 'Beignets '
    }
    for odeur, count in odeurs_data:
        odeurs_labels.append(label_map.get(odeur, odeur))
        odeurs_values.append(count)
        odeurs_couleurs.append(color_map.get(odeur, '#95A5A6'))
    
    # === ÉQUIPEMENT (Barres) ===
    c.execute('SELECT equipement FROM sondages')
    equipements = c.fetchall()
    compte_plaque = compte_frigo = compte_micro_ondes = compte_rien = 0
    for e in equipements:
        if e[0]:
            eq = e[0].lower()
            if 'plaque' in eq: compte_plaque += 1
            if 'frigo' in eq: compte_frigo += 1
            if 'micro_ondes' in eq: compte_micro_ondes += 1
            if 'rien' in eq: compte_rien += 1
    
    # === BUDGET (Barres) ===
    c.execute('SELECT budget_max FROM sondages')
    budgets = c.fetchall()
    budget_ranges = {'0-500 FCFA': 0, '501-1000 FCFA': 0, '1001-2000 FCFA': 0, '2000+ FCFA': 0}
    for b in budgets:
        val = b[0]
        if val <= 500: budget_ranges['0-500 FCFA'] += 1
        elif val <= 1000: budget_ranges['501-1000 FCFA'] += 1
        elif val <= 2000: budget_ranges['1001-2000 FCFA'] += 1
        else: budget_ranges['2000+ FCFA'] += 1
    
    # === PEURS (Donut) ===
    c.execute('SELECT peur_cuisine, COUNT(*) FROM sondages WHERE peur_cuisine IS NOT NULL AND peur_cuisine != "" GROUP BY peur_cuisine')
    peurs_data = c.fetchall()
    peur_map = {
        'rater_cuisson': 'Rater la cuisson ', 'gachis': 'Gâcher ingrédients ',
        'vaisselle': 'Trop de vaisselle ', 'temps': 'Perdre 2h '
    }
    peurs_labels = [peur_map.get(p[0], p[0]) for p in peurs_data]
    peurs_values = [p[1] for p in peurs_data]
    
    # === PLATS SAOULANTS (Top 5) ===
    c.execute('''SELECT plat_saoulant, COUNT(*) FROM sondages 
                 WHERE plat_saoulant IS NOT NULL AND plat_saoulant != '' 
                 GROUP BY plat_saoulant ORDER BY COUNT(*) DESC LIMIT 5''')
    plats_saoulants_data = c.fetchall()
    
    # === REPAS FLEMME (Top 5) ===
    c.execute('''SELECT repas_flemme, COUNT(*) FROM sondages 
                 WHERE repas_flemme IS NOT NULL AND repas_flemme != '' 
                 GROUP BY repas_flemme ORDER BY COUNT(*) DESC LIMIT 5''')
    repas_flemme_data = c.fetchall()
    
    # === ODEUR MAISON (Nuage de mots simplifié) ===
    c.execute('''SELECT odeur_maison FROM sondages WHERE odeur_maison IS NOT NULL AND odeur_maison != \'\'
    ''')
    odeurs_maison = [o[0] for o in c.fetchall()]
    
    conn.close()
    
    return jsonify({
        "total_reponses": total,
        "budget_moyen": round(budget_moyen, 2),
        "odeurs": {"labels": odeurs_labels, "data": odeurs_values, "backgroundColor": odeurs_couleurs},
        "equipement": {
            "labels": ['Plaque unique', 'Frigo', 'Micro-ondes', 'Rien du tout '],
            "data": [compte_plaque, compte_frigo, compte_micro_ondes, compte_rien],
            "backgroundColor": ['#3498DB', '#2ECC71', '#9B59B6', '#E74C3C']
        },
        "budget_detail": {
            "labels": list(budget_ranges.keys()),
            "data": list(budget_ranges.values()),
            "backgroundColor": '#E67E22'
        },
        "peurs": {
            "labels": peurs_labels, "data": peurs_values,
            "backgroundColor": ['#E74C3C', '#F1C40F', '#3498DB', '#9B59B6']
        },
        "plats_saoulants": {
            "labels": [p[0][:30] for p in plats_saoulants_data],
            "data": [p[1] for p in plats_saoulants_data]
        },
        "repas_flemme": {
            "labels": [r[0][:30] for r in repas_flemme_data],
            "data": [r[1] for r in repas_flemme_data]
        },
        "odeurs_maison": odeurs_maison[:10]  # Échantillon pour le dashboard
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000, host='0.0.0.0')