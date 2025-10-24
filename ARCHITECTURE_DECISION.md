# Architecture Decision: Bundled MCP Approach

**Date**: October 2025
**Status**: ✅ **APPROVED - DEFAULT STRATEGY**
**Decision**: Bundle WordPress MCP Adapter + Abilities API in WordPress.org plugin

---

## Executive Summary

After reviewing the architecture validation report and considering project timeline, we are adopting the **bundled MCP approach** as our **default strategy**.

### Default Strategy: Bundle MCP Adapter + Abilities

```
Next.js SaaS (Vercel)
    ↓
Vercel AI SDK Agent
    ↓
Dynamic MCP Client (streamableHTTP)
    ↓
WordPress Plugin (bundled MCP Adapter + Abilities API)
    ↓
Client WordPress Sites
```

### Fallback Strategy: Hybrid Approach (If Needed)

Only if WordPress.org rejects bundled plugin or MCP proves unstable:
```
Next.js SaaS → Static Tools (mcp-to-ai-sdk) → Direct REST API calls
```

---

## Why This is Valid and Preferred

### Legal Compliance ✅
- **WordPress MCP Adapter**: GPL-2.0-or-later (WordPress organization)
- **WordPress Abilities API**: GPL-2.0-or-later (WordPress organization)
- **Bundling**: Explicitly permitted under GPL
- **Attribution**: Required (will include in plugin headers)
- **Licensing**: Plugin inherits GPL-2.0-or-later

### Technical Viability ✅
- **MCP Protocol**: Stable, adopted by OpenAI, Microsoft, Block
- **StreamableHTTP Transport**: Production-ready (290-300 req/sec)
- **WordPress 6.9**: Releases December 2025 with Abilities API in core
- **Connection Management**: Proven patterns (pooling, circuit breakers)
- **Performance**: 2-3% overhead vs direct REST (acceptable for AI workflows)

### Timeline Alignment ✅
- **Now - Dec 2025**: Develop with MCP locally
- **Dec 2025**: WordPress 6.9 releases, Abilities API stabilizes
- **Jan 2026**: Build WordPress.org plugin with bundled MCP
- **Feb 2026**: Submit to WordPress.org (9-week review)
- **Q1-Q2 2026**: Onboard first clients with approved plugin

### Architectural Benefits ✅
- **Simplicity**: One consistent approach from dev to production
- **AI-Native**: True MCP protocol integration (dynamic tool discovery)
- **Maintainability**: No dual tool definition systems
- **Ecosystem**: Full leverage of MCP improvements
- **Future-Proof**: Aligned with WordPress 6.9+ direction

### WordPress.org Approval Strategy ✅
- **Wait for WP 6.9**: Bundle stable Abilities API (core integration)
- **Attribution**: Clear headers citing WordPress MCP Adapter + Abilities
- **Documentation**: Explain bundling rationale in plugin description
- **Plugin Check**: Comprehensive testing before submission
- **Security**: Follow WordPress Coding Standards strictly
- **Precedent**: WordPress.org accepts bundled GPL libraries

---

## Implementation Plan

### Phase 1: Development (Oct - Dec 2025)

**Current - December 2025**:
- ✅ Continue MCP development locally (Docker WordPress)
- ✅ Build Next.js SaaS core (auth, multi-tenant, UI)
- ✅ Test dynamic MCP connections with streamableHTTP
- ✅ Implement credential encryption (AES-256-GCM)
- ✅ Build PostgreSQL multi-tenant architecture

**WordPress 6.9 Release (December 2025)**:
- Verify Abilities API stability in core
- Test MCP Adapter compatibility with WP 6.9
- Validate no breaking changes
- Update dependencies to stable versions

### Phase 2: Plugin Development (Jan 2026)

**WordPress.org Plugin Contents**:
```
wp-ai-editor-connector/
├── includes/
│   ├── mcp-adapter/          # Bundled MCP Adapter (GPL-2.0-or-later)
│   ├── abilities/             # Bundled Abilities API (GPL-2.0-or-later)
│   ├── setup-wizard.php       # Application Password setup
│   ├── health-check.php       # Connection diagnostics
│   ├── security.php           # Best practices documentation
│   └── rest-endpoints.php     # Custom endpoints (if needed)
├── plugin.php                 # Main plugin file
├── LICENSE.txt                # GPL-2.0-or-later
└── README.txt                 # WordPress.org readme
```

**Plugin Headers**:
```php
/**
 * Plugin Name: WP AI Editor Connector
 * Description: Connect your WordPress site to AI-powered content editing SaaS
 * Version: 1.0.0
 * Author: [Your Name]
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * This plugin bundles:
 * - WordPress MCP Adapter (GPL-2.0-or-later) - https://github.com/WordPress/wordpress-mcp-adapter
 * - WordPress Abilities API (GPL-2.0-or-later) - https://github.com/WordPress/abilities-api
 */
```

**Features**:
- Application Password setup wizard
- MCP connection health checks
- Security best practices guidance
- Diagnostic tools for troubleshooting
- Clear documentation and onboarding

### Phase 3: WordPress.org Submission (Feb 2026)

**Pre-Submission Checklist**:
- [ ] Run Plugin Check tool (100% pass rate)
- [ ] Security review (OWASP, XSS, SQL injection)
- [ ] Code standards compliance (WordPress Coding Standards)
- [ ] GPL licensing verification
- [ ] Attribution headers for bundled code
- [ ] Comprehensive README.txt
- [ ] Privacy policy disclosure (external API connections)
- [ ] Escape all output (`esc_html()`, `esc_attr()`, `esc_url()`)
- [ ] Sanitize all input (`sanitize_text_field()`, etc.)
- [ ] Nonces on all forms
- [ ] Prepared database queries (`$wpdb->prepare()`)

**Submission Process**:
1. Submit to WordPress.org plugin directory
2. Wait for review (avg 9 weeks)
3. Address reviewer feedback
4. Iterate until approval

**Expected Outcome**: ✅ Approval (bundling GPL libraries is standard practice)

### Phase 4: Production Deployment (Q1-Q2 2026)

**Infrastructure**:
- Next.js on Vercel
- PostgreSQL with RLS (Vercel Postgres/Supabase)
- Redis for caching (Upstash)
- BullMQ workers (Railway/Render)
- Monitoring (Sentry/Datadog)

**Client Onboarding**:
1. Client installs plugin from WordPress.org
2. Run setup wizard (Application Password creation)
3. Connect to SaaS (enter credentials)
4. Health check validates connection
5. Start using AI editing features

**Success Metrics**:
- MCP connection success rate: 99%+
- Tool execution success rate: 95%+
- Average API response time: <500ms
- Client onboarding time: <15 minutes

---

## Fallback Strategy (Only If Needed)

**If WordPress.org rejects the plugin** due to bundled experimental code:

### Option A: GitHub Distribution (Short-term)
- Distribute via GitHub releases
- Provide installation documentation
- Build reputation and iterate
- Re-submit after proving stability

### Option B: Hybrid Approach (Long-term)
- Create lightweight plugin (no MCP bundling)
- Use static tools generated via `mcp-to-ai-sdk`
- Tools make direct REST API calls
- Submit simplified plugin to WordPress.org

**Note**: Fallback is ONLY if primary strategy fails. We expect success with bundled approach post-WP 6.9.

---

## Risk Mitigation

### Risk 1: WordPress.org Rejection
- **Probability**: Low (waiting for WP 6.9, stable Abilities API)
- **Impact**: Medium (delays client onboarding by 1-2 months)
- **Mitigation**:
  - Comprehensive Plugin Check testing
  - Clear attribution and documentation
  - Wait for WP 6.9 stable release
  - Fallback to GitHub distribution if rejected

### Risk 2: MCP Adapter Breaking Changes
- **Probability**: Low (post-WP 6.9 stability expected)
- **Impact**: Medium (requires plugin updates)
- **Mitigation**:
  - Pin specific versions in bundle
  - Monitor WordPress 6.9 development
  - Test thoroughly post-release
  - Version control bundled dependencies

### Risk 3: Vercel AI SDK Instability
- **Probability**: Medium (`experimental_createMCPClient` status unknown)
- **Impact**: Medium (may need SDK workarounds)
- **Mitigation**:
  - Monitor Vercel AI SDK releases
  - Implement robust error handling
  - Have fallback to direct MCP protocol if needed
  - Contribute to SDK issues if found

### Risk 4: Production Performance Issues
- **Probability**: Low (MCP overhead is 2-3%)
- **Impact**: Low (still within acceptable AI workflow latency)
- **Mitigation**:
  - Connection pooling (critical)
  - Redis caching layer
  - Circuit breakers for failed connections
  - Graceful degradation strategies

### Risk 5: Client WordPress Configuration Issues
- **Probability**: High (30-40% of sites have some issue)
- **Impact**: Medium (requires support during onboarding)
- **Mitigation**:
  - Pre-flight testing checklist
  - Automated diagnostic script in plugin
  - Clear troubleshooting documentation
  - Support team training

---

## Success Criteria

### Technical Success
- ✅ MCP connections stable with 99%+ uptime
- ✅ Tool execution success rate 95%+
- ✅ Response times under 500ms (API) / 5s (agent)
- ✅ Zero credential leaks
- ✅ Scalable to 100+ client sites

### Business Success
- ✅ WordPress.org plugin approved
- ✅ Client onboarding under 15 minutes
- ✅ Support tickets under 2 per client per month
- ✅ Client retention rate over 90%
- ✅ Positive client feedback (NPS > 50)

### Security Success
- ✅ Zero security incidents
- ✅ 100% credential encryption compliance
- ✅ Complete audit logging
- ✅ Failed authentication detection under 1 minute

---

## Why This Decision Makes Sense

1. **Timing**: WordPress 6.9 releases in 2 months (December 2025) with Abilities API in core
2. **Stability**: Waiting for WP 6.9 gives us stable foundation for bundling
3. **Simplicity**: One architecture from dev to production (no dual systems)
4. **Legality**: Both MCP Adapter and Abilities are GPL-licensed by WordPress org
5. **Future-Proof**: Aligned with WordPress's official MCP integration direction
6. **Client Timeline**: Q1 2026 onboarding goal is achievable with this plan
7. **WordPress.org**: Bundling stable, core-integrated libraries is standard practice

---

## Commitment

**This is our default strategy.** We will:

1. ✅ Build with bundled MCP Adapter + Abilities API
2. ✅ Wait for WordPress 6.9 stability (December 2025)
3. ✅ Submit to WordPress.org with bundled code (January-February 2026)
4. ✅ Onboard clients with approved plugin (Q1-Q2 2026)
5. ⚠️ Only fall back to hybrid approach if WordPress.org rejects (unlikely)

**This is the path forward.**

---

## Next Steps

1. **Continue current development** with MCP locally
2. **Build SaaS core features** (multi-tenant, auth, UI)
3. **Monitor WordPress 6.9** development and release (December 2025)
4. **Test WP 6.9 + MCP Adapter** immediately after release
5. **Build WordPress.org plugin** with bundled MCP (January 2026)
6. **Submit to WordPress.org** (February 2026)
7. **Onboard first clients** after approval (Q1-Q2 2026)

---

**Status**: ✅ **APPROVED AND ACTIVE**
**Last Updated**: October 2025
**Next Review**: After WordPress 6.9 release (December 2025)