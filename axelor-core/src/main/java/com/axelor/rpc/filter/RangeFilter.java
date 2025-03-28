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

import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;

class RangeFilter extends SimpleFilter {

  private Collection<?> values;

  public RangeFilter(Operator operator, String fieldName, Object value) {
    super(operator, fieldName, value);

    if (!(value instanceof Collection<?>)) {
      throw new IllegalArgumentException();
    }

    values = (Collection<?>) value;
  }

  @Override
  public String getQuery() {

    if (getOperator() == Operator.BETWEEN || getOperator() == Operator.NOT_BETWEEN) {
      return String.format("(%s %s ? AND ?)", getOperand(), getOperator());
    }

    StringBuilder sb = new StringBuilder(getOperand());
    sb.append(" ").append(getOperator()).append(" (");

    Iterator<?> iter = values.iterator();
    iter.next();
    sb.append("?");
    while (iter.hasNext()) {
      sb.append(", ").append("?");
      iter.next();
    }

    sb.append(")");
    return sb.toString();
  }

  @Override
  public List<Object> getParams() {
    return new ArrayList<Object>(values);
  }
}
