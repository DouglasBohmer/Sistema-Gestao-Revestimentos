package br.com.redeasso.gestao.calculo.domain;
import br.com.redeasso.gestao.calculo.api.CalculoResponse;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
@Entity @Table(name="calculos_historico")
public class CalculoHistorico {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="piso_nome",nullable=false,length=200) private String pisoNome;
    @Column(name="criado_em",nullable=false,updatable=false) private Instant criadoEm;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb",updatable=false) private CalculoResponse resultado;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb",updatable=false) private Map<String,BigDecimal> parametros;
    protected CalculoHistorico() {}
    public CalculoHistorico(CalculoResponse resultado, Map<String,BigDecimal> parametros) {
        this.pisoNome=resultado.piso().nome(); this.criadoEm=Instant.now(); this.resultado=resultado; this.parametros=Map.copyOf(parametros);
    }
    public Long getId(){return id;}
    public String getPisoNome(){return pisoNome;}
    public Instant getCriadoEm(){return criadoEm;}
    public CalculoResponse getResultado(){return resultado;}
}
