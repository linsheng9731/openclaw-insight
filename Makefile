.PHONY: build dev test clean release install lint

VERSION ?= $(shell node -p "require('./package.json').version")
PLATFORMS := linux-x64 linux-arm64 darwin-x64 darwin-arm64

# ─── Development ─────────────────────────────────────────
build:
	npm run build

dev:
	npm run dev

test:
	npm test

clean:
	rm -rf dist release

lint:
	npx tsc --noEmit

# ─── Installation ────────────────────────────────────────
install: build
	npm link

uninstall:
	npm unlink -g openclaw-insight

# ─── Release ─────────────────────────────────────────────
release: clean build
	@echo "📦 Packaging v$(VERSION)..."
	@mkdir -p release
	@for platform in $(PLATFORMS); do \
		echo "  → $${platform}"; \
		dir="release/openclaw-insight-$(VERSION)-$${platform}"; \
		mkdir -p "$${dir}/dist"; \
		cp -r dist/* "$${dir}/dist/"; \
		cp package.json README.md "$${dir}/"; \
		cd "$${dir}" && npm install --omit=dev 2>/dev/null; cd -; \
		tar czf "release/openclaw-insight-$(VERSION)-$${platform}.tar.gz" -C release "openclaw-insight-$(VERSION)-$${platform}"; \
		rm -rf "$${dir}"; \
	done
	@cd release && (sha256sum *.tar.gz 2>/dev/null || shasum -a 256 *.tar.gz) > checksums.txt
	@echo "✔ Release artifacts in release/"
	@ls -lh release/

# ─── Git Tag ─────────────────────────────────────────────
tag:
	@echo "Tagging v$(VERSION)..."
	git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	git push origin "v$(VERSION)"
	@echo "✔ Tag v$(VERSION) pushed — GitHub Actions will create the release"

# ─── Help ────────────────────────────────────────────────
help:
	@echo "🦞 openclaw-insight Makefile"
	@echo ""
	@echo "  make build     Build TypeScript"
	@echo "  make dev       Run in development mode"
	@echo "  make test      Run tests"
	@echo "  make lint      Type-check"
	@echo "  make clean     Remove build artifacts"
	@echo "  make install   Link globally (for dev)"
	@echo "  make release   Create release archives"
	@echo "  make tag       Git tag + push (triggers CI release)"
	@echo "  make help      This message"
