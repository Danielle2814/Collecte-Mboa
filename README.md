# MboaCollect - MboaData

## Description

**MboaCollect** est une application web qui collecte et analyse les données sur les **habitudes alimentaires des étudiants**.

L'application pose un sondage détaillé aux utilisateurs pour comprendre:
- Leurs équipements de cuisine
- Leurs habitudes alimentaires
- Leurs contraintes budgétaires
- Leurs préférences culinaires et olfactives

Les résultats sont visualisés dans un **dashboard interactif** avec des statistiques et des graphiques.

---

##  Fonctionnalités

 **Formulaire de sondage** - Collecte d'informations détaillées sur les habitudes alimentaires  
 **Base de données SQLite** - Stockage sécurisé des réponses  
 **Dashboard analytique** - Visualisation des résultats avec Chart.js  
 **API REST** - Backend Flask pour la gestion des données  
 **Interface responsive** - Design adapté à tous les appareils  
 **Protection CORS** - Sécurité des requêtes cross-origin  

---

##  Architecture

```
MboaCollect/
├── Frontend/              # Interface utilisateur
│   ├── dashboard.html     # Dashboard d'analyse
│   ├── script.js          # Logique du frontend
│   └── style.css          # Styles CSS
├── Backend/               # API et logique serveur
│   ├── app.py             # Application Flask
│   └── requirements.txt    # Dépendances Python
├── data/                  # Dossier de données
│   └── mboa_data.db       # Base de données SQLite
└── index.html             # Page d'accueil
```

---

##  Installation

### Prérequis
- Python 3.7+
- Un navigateur web moderne

### Étapes

1. **Cloner le projet**
   ```bash
   git clone git@github.com:Danielle2814/Collecte-Mboa.git
   cd MboaCollect
   ```

2. **Créer un environnement virtuel** (recommandé)
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Sur Windows
   source venv/bin/activate  # Sur macOS/Linux
   ```

3. **Installer les dépendances**
   ```bash
   pip install flask flask-cors
   ```

4. **Lancer le serveur**
   ```bash
   python Backend/app.py
   ```

5. **Accéder à l'application**
   - Ouvrez votre navigateur et allez à `http://localhost:5000`

---

##  Base de Données

La table `sondages` contient les champs suivants:

| Champ | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Identifiant unique |
| `equipement` | TEXT | Équipements de cuisine disponibles |
| `frigo_vide` | INTEGER | État du réfrigérateur |
| `repas_3_jours` | TEXT | Repas préférés sur 3 jours |
| `budget_max` | INTEGER | Budget maximum par repas |
| `ingredients_phares` | TEXT | Ingrédients favoris |
| `temps_max` | INTEGER | Temps maximum de préparation |
| `odeur_maison` | TEXT | Odeur sentie à la maison |
| `odeur_preferee` | TEXT | Odeur préférée |
| `ip_address` | TEXT | Adresse IP du répondant |
| `date_soumission` | TIMESTAMP | Date/heure de la réponse |

---

## 🔧 API Endpoints

### Récupérer les données du sondage
```
GET /api/reponses
```
Retourne toutes les réponses du sondage en JSON.

### Soumettre une réponse
```
POST /api/soumettre
```
Envoie une nouvelle réponse de sondage.

### Récupérer les statistiques
```
GET /api/statistiques
```
Retourne les statistiques agrégées des réponses.

---

##  Technologies Utilisées

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Base de données**: SQLite
- **Visualisation**: Chart.js
- **Autre**: CORS (Cross-Origin Resource Sharing)

---

##  Structure des Fichiers

- **Frontend/**
  - `dashboard.html` - Page principale avec KPIs et graphiques
  - `script.js` - Logique JavaScript pour les interactions
  - `style.css` - Feuille de styles

- **Backend/**
  - `app.py` - Application Flask avec routes API et initialisation BD
  - `requirements.txt` - Dépendances Python

- **data/**
  - `mboa_data.db` - Base de données SQLite (créée automatiquement)

---

##  Cas d'Usage

Cette application est idéale pour:
-  Mener une étude sur les habitudes alimentaires estudiantes
-  Analyser les préférences culinaires par budget
-  Tester un concept de collecte de données
-  Projet académique de l'UE INF232 : STATISTIQUES ET ANALYSES DE DONNEES

---

##  Contribution

Les contributions sont bienvenues! Pour proposer des améliorations:
1. Clonez le projet
2. Créez une branche (`git checkout -b feature/amelioration`)
3. Committez vos changements (`git commit -m 'Ajoute une amélioration'`)
4. Poussez vers la branche (`git push origin feature/amelioration`)
5. Ouvrez une Pull Request

---

##  Licence

Ce projet est sous licence MCT.

---

##  Contact

Pour toute question ou suggestion, n'hésitez pas à nous contacter!

---

**Bon appétit numérique!**
