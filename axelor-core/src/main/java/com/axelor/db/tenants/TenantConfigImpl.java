/*
 * Axelor Business Solutions
 *
 * Copyright (C) 2005-2025 Axelor (<http://axelor.com>).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package com.axelor.db.tenants;

import com.axelor.common.StringUtils;
import com.google.common.base.MoreObjects;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The default implementation of {@link TenantConfig} uses configuration provided from
 * axelor-config.properties.
 *
 * <p>The format of axelor-config.properties are as follows:
 *
 * <pre>
 * db.default.visible = false
 * db.default.driver = org.postgresql.Driver
 * db.default.url = jdbc:postgresql://localhost:5432/axelor-db-demo
 * db.default.user = axelor
 * db.default.password =
 *
 * db.company1.name = Company 1
 * db.company1.driver = org.postgresql.Driver
 * db.company1.url = jdbc:postgresql://localhost:5432/axelor-db1
 * db.company1.user = axelor
 * db.company1.password =
 *
 * db.company2.name = Company 2
 * db.company2.driver = org.postgresql.Driver
 * db.company2.url = jdbc:postgresql://localhost:5432/axelor-db2
 * db.company2.user = axelor
 * db.company2.password =
 * </pre>
 *
 * <p>The format of key name is <code>db.[tenant-id].[config-name]</code>
 */
public class TenantConfigImpl implements TenantConfig {

  private Boolean active;
  private Boolean visible;

  private String tenantId;
  private String tenantName;
  private String tenantHosts;
  private String tenantRoles;

  private String jndiDataSource;

  private String jdbcDriver;
  private String jdbcUrl;
  private String jdbcUser;
  private String jdbcPassword;

  private static final Pattern PATTERN_DB_NAME = Pattern.compile("db\\.(.*?)\\.name");

  private static final Map<String, TenantConfig> CONFIGS = new ConcurrentHashMap<>();

  private TenantConfigImpl() {}

  public static List<TenantConfig> findByHost(Map<String, String> props, String host) {
    final List<TenantConfig> all = new ArrayList<>();
    for (String key : props.keySet()) {
      Matcher matcher = PATTERN_DB_NAME.matcher(key);
      if (matcher.matches()) {
        final String tenantId = matcher.group(1);
        final String hosts = getHosts(props, tenantId);

        if (StringUtils.isBlank(hosts)) {
          all.add(findById(props, tenantId));
        } else if (Arrays.asList(hosts.split("\\s*,\\s*")).contains(host)) {
          // Resolve single tenant in case of hosts match.
          return Collections.singletonList(findById(props, tenantId));
        }
      }
    }
    if (all.isEmpty() && matches(props, DEFAULT_TENANT_ID, host)) {
      all.add(findById(props, DEFAULT_TENANT_ID));
    }

    // sort by name
    try {
      all.sort((a, b) -> a.getTenantName().compareTo(b.getTenantName()));
    } catch (Exception e) {
    }

    all.removeIf(Objects::isNull);

    return all;
  }

  public static TenantConfig findById(Map<String, String> props, String tenantId) {
    if (CONFIGS.containsKey(tenantId)) {
      return CONFIGS.get(tenantId);
    }

    final String prefix = "db." + tenantId;
    final TenantConfigImpl cfg = new TenantConfigImpl();

    final String active = get(props, prefix, "active");
    final String visible = get(props, prefix, "visible");

    cfg.active = active == null || "true".equalsIgnoreCase(active);
    cfg.visible = visible == null || "true".equalsIgnoreCase(visible);

    cfg.tenantId = tenantId;
    cfg.tenantName = get(props, prefix, "name");
    cfg.tenantHosts = get(props, prefix, "hosts");
    cfg.tenantRoles = get(props, prefix, "roles");

    cfg.jndiDataSource = get(props, prefix, "datasource");

    cfg.jdbcDriver = get(props, prefix, "driver");
    cfg.jdbcUrl = get(props, prefix, "url");
    cfg.jdbcUser = get(props, prefix, "user");
    cfg.jdbcPassword = get(props, prefix, "password");

    if (cfg.jndiDataSource == null && (cfg.jdbcDriver == null || cfg.jdbcUrl == null)) {
      return null;
    }

    CONFIGS.put(tenantId, cfg);

    return cfg;
  }

  private static String getHosts(Map<String, String> props, String tenantId) {
    final String key = "db." + tenantId + ".hosts";
    return props.getOrDefault(key, "");
  }

  private static boolean matches(Map<String, String> props, String tenantId, String host) {
    final String hosts = getHosts(props, tenantId);
    return StringUtils.isBlank(hosts) || Arrays.asList(hosts.split("\\s*,\\s*")).contains(host);
  }

  private static String get(Map<String, String> props, String prefix, String name) {
    String key = prefix + "." + name;
    String val = props.get(key);
    return StringUtils.isBlank(val) ? null : val;
  }

  @Override
  public Boolean getActive() {
    return active;
  }

  @Override
  public Boolean getVisible() {
    return visible;
  }

  @Override
  public String getTenantId() {
    return tenantId;
  }

  @Override
  public String getTenantName() {
    return tenantName;
  }

  @Override
  public String getTenantHosts() {
    return tenantHosts;
  }

  @Override
  public String getTenantRoles() {
    return tenantRoles;
  }

  @Override
  public String getJndiDataSource() {
    return jndiDataSource;
  }

  @Override
  public String getJdbcDriver() {
    return jdbcDriver;
  }

  @Override
  public String getJdbcUrl() {
    return jdbcUrl;
  }

  @Override
  public String getJdbcUser() {
    return jdbcUser;
  }

  @Override
  public String getJdbcPassword() {
    return jdbcPassword;
  }

  @Override
  public String toString() {
    return MoreObjects.toStringHelper(this)
        .add("tenantId", tenantId)
        .add("tenantName", tenantName)
        .add("jndiDataSource", jndiDataSource)
        .add("jdbcDriver", jdbcDriver)
        .add("jdbcUrl", jdbcUrl)
        .omitNullValues()
        .toString();
  }
}
