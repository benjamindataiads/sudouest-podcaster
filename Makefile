.PHONY: help install start dev db-start db-stop db-migrate db-reset db-studio stop clean logs test build

# Variables
# Détection automatique de docker-compose vs docker compose
DOCKER_COMPOSE := $(shell command -v docker-compose 2> /dev/null)
ifdef DOCKER_COMPOSE
    COMPOSE = docker-compose
else
    COMPOSE = docker compose
endif
NPM = npm

# Couleurs pour l'affichage
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m # No Color

help: ## Affiche l'aide
	@echo "$(BLUE)Sud-Ouest Podcaster - Commandes disponibles$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Installe les dépendances du projet
	@echo "$(BLUE)📦 Installation des dépendances...$(NC)"
	@rm -rf node_modules/.cache
	$(NPM) install
	@echo "$(GREEN)✅ Dépendances installées$(NC)"

db-start: ## Démarre PostgreSQL
	@echo "$(BLUE)🚀 Démarrage de PostgreSQL...$(NC)"
	$(COMPOSE) up db -d
	@echo "$(GREEN)✅ PostgreSQL démarré sur le port 5433$(NC)"
	@sleep 2

db-stop: ## Arrête PostgreSQL
	@echo "$(YELLOW)⏸️  Arrêt de PostgreSQL...$(NC)"
	$(COMPOSE) stop db
	@echo "$(GREEN)✅ PostgreSQL arrêté$(NC)"

db-migrate: db-start ## Applique les migrations de la base de données
	@echo "$(BLUE)📊 Application des migrations...$(NC)"
	@sleep 2
	$(NPM) run db:generate
	@if [ -f .env.local ]; then \
		export $$(cat .env.local | grep -v '^#' | xargs) && $(NPM) run db:push; \
	else \
		echo "$(YELLOW)⚠️  .env.local not found, using default DATABASE_URL$(NC)"; \
		DATABASE_URL=postgresql://podcaster:podcaster_dev@localhost:5433/sudouest_podcaster $(NPM) run db:push; \
	fi
	@echo "$(GREEN)✅ Migrations appliquées$(NC)"

db-reset: ## Réinitialise complètement la base de données
	@echo "$(YELLOW)⚠️  Réinitialisation de la base de données...$(NC)"
	$(COMPOSE) down -v
	@echo "$(GREEN)✅ Base de données réinitialisée$(NC)"
	@$(MAKE) db-migrate

db-studio: ## Ouvre Drizzle Studio (interface DB)
	@echo "$(BLUE)🎨 Ouverture de Drizzle Studio...$(NC)"
	@echo "$(GREEN)Interface disponible sur http://localhost:4983$(NC)"
	$(NPM) run db:studio

dev: ## Lance l'application en mode développement
	@echo "$(BLUE)🚀 Démarrage de l'application...$(NC)"
	@echo "$(GREEN)Application disponible sur http://localhost:3001$(NC)"
	$(NPM) run dev

start: install db-migrate ## 🚀 COMMANDE PRINCIPALE : Lance tout (install + DB + migrations + dev)
	@echo ""
	@echo "$(GREEN)✅ Tout est prêt !$(NC)"
	@echo "$(BLUE)📱 Application: http://localhost:3001$(NC)"
	@echo "$(BLUE)📊 API Articles: http://localhost:3001/api/articles$(NC)"
	@echo ""
	@$(MAKE) dev

quick-start: db-start ## Lance rapidement l'app (sans réinstaller)
	@echo "$(BLUE)⚡ Démarrage rapide...$(NC)"
	@sleep 2
	@echo "$(GREEN)✅ Base de données prête$(NC)"
	@echo "$(GREEN)📱 Lancement de l'application sur http://localhost:3001$(NC)"
	@$(MAKE) dev

stop: ## Arrête tous les services Docker
	@echo "$(YELLOW)⏸️  Arrêt de tous les services...$(NC)"
	$(COMPOSE) down
	@echo "$(GREEN)✅ Services arrêtés$(NC)"

clean: stop ## Nettoie complètement (arrête tout + supprime node_modules)
	@echo "$(YELLOW)🧹 Nettoyage complet...$(NC)"
	rm -rf node_modules
	rm -rf .next
	rm -rf drizzle
	@echo "$(GREEN)✅ Nettoyage terminé$(NC)"

logs: ## Affiche les logs de PostgreSQL
	$(COMPOSE) logs -f db

logs-app: ## Affiche les logs de l'application
	$(COMPOSE) logs -f app

ps: ## Affiche les services en cours d'exécution
	@echo "$(BLUE)Services actifs :$(NC)"
	@$(COMPOSE) ps

build: ## Build l'application pour la production
	@echo "$(BLUE)🏗️  Build de production...$(NC)"
	$(NPM) run build
	@echo "$(GREEN)✅ Build terminé$(NC)"

docker-start: ## Lance toute l'application avec Docker
	@echo "$(BLUE)🐳 Démarrage avec Docker...$(NC)"
	$(COMPOSE) up -d
	@echo "$(GREEN)✅ Application disponible sur http://localhost:3001$(NC)"

docker-logs: ## Affiche tous les logs Docker
	$(COMPOSE) logs -f

test-rss: ## Teste la connexion au flux RSS de Sud-Ouest
	@echo "$(BLUE)🔍 Test du flux RSS...$(NC)"
	@curl -s https://www.sudouest.fr/rss | head -20
	@echo ""
	@echo "$(GREEN)✅ Flux RSS accessible$(NC)"

check-env: ## Vérifie que le fichier .env.local existe
	@if [ ! -f .env.local ]; then \
		echo "$(YELLOW)⚠️  Le fichier .env.local n'existe pas$(NC)"; \
		echo "$(BLUE)Créez-le avec :$(NC)"; \
		echo "cp .env.example .env.local"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Fichier .env.local trouvé$(NC)"

status: ## Affiche le statut de l'application
	@echo "$(BLUE)📊 Statut de l'application$(NC)"
	@echo ""
	@echo "$(GREEN)Services Docker :$(NC)"
	@$(COMPOSE) ps
	@echo ""
	@if [ -f .env.local ]; then \
		echo "$(GREEN)✅ .env.local présent$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  .env.local manquant$(NC)"; \
	fi
	@echo ""
	@if [ -d node_modules ]; then \
		echo "$(GREEN)✅ node_modules installés$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  node_modules manquants$(NC)"; \
	fi

