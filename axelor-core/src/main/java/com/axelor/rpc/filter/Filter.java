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
package com.axelor.rpc.filter;

import com.axelor.common.StringUtils;
import com.axelor.db.Model;
import com.axelor.db.Query;
import com.google.common.collect.Lists;
import java.util.Collection;
import java.util.List;

public abstract class Filter {

  private String query;
  private boolean translate;

  public abstract String getQuery();

  public abstract List<Object> getParams();

  public <T extends Model> Query<T> build(Class<T> klass) {
    Query<T> query = Query.of(klass);
    StringBuilder sb = new StringBuilder(this.toString());
    int n = 0, i = sb.indexOf("?");
    while (i > -1) {
      sb.replace(i, i + 1, "?" + (++n));
      i = sb.indexOf("?", i + 1);
    }
    if (StringUtils.notBlank(sb)) {
      query.filter(sb.toString(), getParams().toArray());
    }
    return query;
  }

  /**
   * Set whether to use translation join.
   *
   * @param translate
   * @return filter
   */
  public Filter translate(boolean translate) {
    this.translate = translate;
    return this;
  }

  /**
   * Use translation join.
   *
   * @return filter
   */
  public Filter translate() {
    return translate(true);
  }

  protected boolean isTranslate() {
    return translate;
  }

  @Override
  public String toString() {
    if (query == null) {
      query = getQuery();
    }
    return query;
  }

  public static Filter equals(String fieldName, Object value) {
    return new SimpleFilter(Operator.EQUALS, fieldName, value);
  }

  public static Filter notEquals(String fieldName, Object value) {
    return new SimpleFilter(Operator.NOT_EQUAL, fieldName, value);
  }

  public static Filter lessThan(String fieldName, Object value) {
    return new SimpleFilter(Operator.LESS_THAN, fieldName, value);
  }

  public static Filter greaterThan(String fieldName, Object value) {
    return new SimpleFilter(Operator.GREATER_THAN, fieldName, value);
  }

  public static Filter lessOrEqual(String fieldName, Object value) {
    return new SimpleFilter(Operator.LESS_OR_EQUAL, fieldName, value);
  }

  public static Filter greaterOrEqual(String fieldName, Object value) {
    return new SimpleFilter(Operator.GREATER_OR_EQUAL, fieldName, value);
  }

  public static Filter like(String fieldName, Object value) {
    return LikeFilter.like(fieldName, value);
  }

  public static Filter notLike(String fieldName, Object value) {
    return LikeFilter.notLike(fieldName, value);
  }

  public static Filter isNull(String fieldName) {
    return NullFilter.isNull(fieldName);
  }

  public static Filter notNull(String fieldName) {
    return NullFilter.notNull(fieldName);
  }

  public static Filter in(String fieldName, Collection<?> value) {
    return new RangeFilter(Operator.IN, fieldName, value);
  }

  public static Filter in(String fieldName, Object first, Object second, Object... rest) {
    return in(fieldName, Lists.asList(first, second, rest));
  }

  public static Filter notIn(String fieldName, Collection<?> value) {
    return new RangeFilter(Operator.NOT_IN, fieldName, value);
  }

  public static Filter notIn(String fieldName, Object first, Object second, Object... rest) {
    return notIn(fieldName, Lists.asList(first, second, rest));
  }

  public static Filter between(String fieldName, Object start, Object end) {
    return new RangeFilter(Operator.BETWEEN, fieldName, Lists.newArrayList(start, end));
  }

  public static Filter notBetween(String fieldName, Object start, Object end) {
    return new RangeFilter(Operator.NOT_BETWEEN, fieldName, Lists.newArrayList(start, end));
  }

  public static Filter and(List<Filter> filters) {
    return new LogicalFilter(Operator.AND, filters);
  }

  public static Filter and(Filter first, Filter second, Filter... rest) {
    return and(Lists.asList(first, second, rest));
  }

  public static Filter or(List<Filter> filters) {
    return new LogicalFilter(Operator.OR, filters);
  }

  public static Filter or(Filter first, Filter second, Filter... rest) {
    return or(Lists.asList(first, second, rest));
  }

  public static Filter not(List<Filter> filters) {
    return new LogicalFilter(Operator.NOT, filters);
  }

  public static Filter not(Filter first, Filter second, Filter... rest) {
    return not(Lists.asList(first, second, rest));
  }
}
