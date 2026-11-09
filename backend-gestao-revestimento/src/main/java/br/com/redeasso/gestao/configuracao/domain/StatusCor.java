package br.com.redeasso.gestao.configuracao.domain;
import jakarta.persistence.*;
@Entity @Table(name="status_cores")
public class StatusCor {
    @Id @Column(length=40) private String codigo;
    @Column(length=7,nullable=false) private String cor;
    @Version private long versao;
    protected StatusCor(){}
    public String getCodigo(){return codigo;}
    public String getCor(){return cor;}
    public long getVersao(){return versao;}
    public void atualizar(String cor){if(!cor.matches("^#[0-9a-fA-F]{6}$"))throw new IllegalArgumentException("Cor inválida");this.cor=cor.toLowerCase(java.util.Locale.ROOT);}
}
